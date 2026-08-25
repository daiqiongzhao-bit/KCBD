import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/constants/roles.enum';
import { User } from './entities/user.entity';

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
  ver?: number;
}

/**
 * JWT 策略：从 Bearer Token 中提取并校验 payload。
 * - 密钥优先读取 env JWT_SECRET；生产环境未配置时启动报错（P2-8）。
 * - 校验 token 版本号：与 users.token_version 不一致（改密/重置后）则拒绝。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const secret = config.get<string>('JWT_SECRET', '');
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (!secret) {
      if (nodeEnv === 'production') {
        throw new Error(
          '生产环境必须配置 JWT_SECRET 环境变量，禁止使用默认密钥',
        );
      }
      // eslint-disable-next-line no-console
      console.warn(
        '[JWT] 未配置 JWT_SECRET，使用开发默认密钥 inventory-secret（仅限开发环境，生产环境禁止）',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'inventory-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // token 版本校验：token 中的 ver 必须等于当前用户 token_version
    if (payload.ver !== undefined) {
      const user = await this.userRepo.findOne({
        where: { id: payload.sub },
        select: ['id', 'username', 'role', 'status', 'token_version'],
      });
      if (!user) {
        throw new UnauthorizedException('账号不存在');
      }
      if (user.status === 'frozen') {
        throw new UnauthorizedException('账号已冻结');
      }
      if (user.token_version !== payload.ver) {
        throw new UnauthorizedException('登录已失效，请重新登录');
      }
      return {
        id: user.id,
        username: user.username,
        role: user.role,
      };
    }
    // 兼容旧 token（无 ver 字段）：仅校验基础字段
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
