import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../../common/constants/roles.enum';
import { AuthService, validatePasswordStrength } from './auth.service';
import { RegisterDto } from './dto/login.dto';
import { normalizePage } from '../../common/utils/pagination';

export interface UserQuery {
  keyword?: string;
  role?: Role;
  page?: number;
  size?: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auth: AuthService,
  ) {}

  async list(query: UserQuery) {
    const { page, size } = normalizePage(query.page, query.size, 200);
    const qb = this.userRepo.createQueryBuilder('u');
    if (query.keyword) {
      qb.where('u.username LIKE :kw OR u.display_name LIKE :kw', {
        kw: `%${query.keyword}%`,
      });
    }
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    qb.orderBy('u.id', 'ASC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    const safe = items.map((u) => this.auth.toUserDto(u));
    return { items: safe, total };
  }

  async create(dto: RegisterDto): Promise<{ id: number }> {
    const created = await this.auth.createUser(
      dto.username,
      dto.password,
      dto.display_name || dto.username,
      dto.role || Role.WAREHOUSE,
    );
    return { id: created.id };
  }

  async update(
    id: number,
    body: {
      display_name?: string;
      role?: Role;
      password?: string;
      status?: 'active' | 'frozen';
    },
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    // 内置管理员（id=1）不可冻结，避免锁死系统
    if (id === 1 && body.status === 'frozen') {
      throw new BadRequestException('内置管理员账号不可冻结');
    }
    if (body.display_name !== undefined) user.display_name = body.display_name;
    if (body.role !== undefined) user.role = body.role;
    if (body.status !== undefined) user.status = body.status;
    if (body.password) {
      const pwdErr = validatePasswordStrength(body.password);
      if (pwdErr) throw new BadRequestException(pwdErr);
      user.password_hash = await import('bcryptjs').then((b) =>
        b.hash(body.password!, 10),
      );
      // 管理员改密同样使该用户旧 token 失效
      user.token_version = (user.token_version || 1) + 1;
    }
    await this.userRepo.save(user);
    return { id };
  }

  async remove(id: number) {
    if (id === 1) throw new BadRequestException('内置管理员账号不可删除');
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    await this.userRepo.remove(user);
    return { id };
  }

  async resetPassword(id: number, newPassword: string) {
    return this.auth.resetPassword(id, { newPassword }, Role.ADMIN);
  }
}
