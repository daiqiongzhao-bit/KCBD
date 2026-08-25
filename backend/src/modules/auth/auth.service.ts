import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Role } from '../../common/constants/roles.enum';
import { JwtPayload } from './jwt.strategy';
import { LoginThrottleService } from './login-throttle.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/login.dto';

export interface UserDto {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  status: 'active' | 'frozen';
}

/** 密码强度校验：至少 8 位，且同时包含字母和数字。 */
export const validatePasswordStrength = (pwd: string): string | null => {
  if (!pwd || pwd.length < 8) return '密码至少 8 位';
  if (!/[a-zA-Z]/.test(pwd) || !/\d/.test(pwd)) {
    return '密码需同时包含字母和数字';
  }
  return null;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly throttle: LoginThrottleService,
  ) {}

  /** 登录：校验密码、限流与冻结状态，签发 JWT。 */
  async login(
    dto: LoginDto,
    ip?: string,
  ): Promise<{ token: string; user: UserDto }> {
    const clientIp = ip || 'unknown';
    if (this.throttle.isLockedKey(dto.username, clientIp)) {
      throw new UnauthorizedException(
        '尝试次数过多，账号已被临时锁定，请 15 分钟后再试',
      );
    }
    // password_hash 列已 select:false，此处显式补充查询
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.username = :username', { username: dto.username })
      .getOne();
    if (!user) {
      this.throttle.recordFailure(dto.username, clientIp);
      throw new UnauthorizedException('用户名或密码错误');
    }
    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) {
      this.throttle.recordFailure(dto.username, clientIp);
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status === 'frozen') {
      throw new UnauthorizedException('账号已冻结，请联系管理员');
    }
    this.throttle.clear(dto.username, clientIp);
    return { token: this.sign(user), user: this.toUserDto(user) };
  }

  sign(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      ver: user.token_version || 1,
    };
    return this.jwt.sign(payload, {
      // jsonwebtoken 对纯数字字符串按「毫秒」解析，需把裸数字补成秒单位（如 86400 -> 86400s）
      expiresIn: (process.env.JWT_EXPIRES_IN || '86400').replace(/^(\d+)$/, '$1s'),
    });
  }

  toUserDto(user: User): UserDto {
    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      status: user.status,
    };
  }

  /** 管理员创建用户。 */
  async register(dto: RegisterDto, operatorRole: Role): Promise<UserDto> {
    if (operatorRole !== Role.ADMIN) {
      throw new UnauthorizedException('仅系统管理员可创建用户');
    }
    return this.createUser(
      dto.username,
      dto.password,
      dto.display_name || dto.username,
      dto.role || Role.WAREHOUSE,
    );
  }

  /** 自助注册（公开接口）：默认 warehouse 角色，禁止提权。 */
  async selfRegister(dto: RegisterDto): Promise<UserDto> {
    return this.createUser(
      dto.username,
      dto.password,
      dto.display_name || dto.username,
      Role.WAREHOUSE,
    );
  }

  /** 创建用户（含 bcrypt 哈希 + 密码强度校验）。 */
  async createUser(
    username: string,
    password: string,
    displayName: string,
    role: Role,
  ): Promise<UserDto> {
    const pwdErr = validatePasswordStrength(password);
    if (pwdErr) throw new BadRequestException(pwdErr);
    const exists = await this.userRepo.findOne({ where: { username } });
    if (exists) {
      throw new ConflictException('用户名已存在');
    }
    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({
      username,
      password_hash: hash,
      display_name: displayName,
      role,
    });
    const saved = await this.userRepo.save(user);
    return this.toUserDto(saved);
  }

  /** 当前用户修改自身密码（改密后 token 版本 +1，旧 token 失效）。 */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<null> {
    const pwdErr = validatePasswordStrength(dto.newPassword);
    if (pwdErr) throw new BadRequestException(pwdErr);
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.password_hash);
    if (!ok) {
      throw new BadRequestException('原密码错误');
    }
    user.password_hash = await bcrypt.hash(dto.newPassword, 10);
    user.token_version = (user.token_version || 1) + 1;
    await this.userRepo.save(user);
    return null;
  }

  /** 管理员重置指定用户密码（重置后 token 版本 +1，旧 token 失效）。 */
  async resetPassword(
    targetId: number,
    dto: ResetPasswordDto,
    operatorRole: Role,
  ): Promise<null> {
    if (operatorRole !== Role.ADMIN) {
      throw new UnauthorizedException('仅系统管理员可重置密码');
    }
    const pwdErr = validatePasswordStrength(dto.newPassword);
    if (pwdErr) throw new BadRequestException(pwdErr);
    const user = await this.userRepo.findOne({ where: { id: targetId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    user.password_hash = await bcrypt.hash(dto.newPassword, 10);
    user.token_version = (user.token_version || 1) + 1;
    await this.userRepo.save(user);
    return null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  /** 按 id 查询并返回安全 DTO（不含 password_hash，P0-2）。 */
  async findById(id: number): Promise<UserDto | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    return this.toUserDto(user);
  }
}
