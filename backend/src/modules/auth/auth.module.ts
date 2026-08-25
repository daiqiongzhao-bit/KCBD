import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesController } from './roles.controller';
import { PermissionService } from './permission.service';
import { LoginThrottleService } from './login-throttle.service';
import { User } from './entities/user.entity';
import { RolePermission } from './entities/role-permission.entity';
import { JwtStrategy } from './jwt.strategy';

/** 全局模块：AuthService / PermissionService / TypeOrmModule 全局可用。 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, RolePermission]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'inventory-secret'),
        signOptions: {
          // jsonwebtoken 对纯数字字符串按「毫秒」解析，需把裸数字补成秒单位（如 86400 -> 86400s）
          expiresIn: config
            .get<string>('JWT_EXPIRES_IN', '86400')
            .replace(/^(\d+)$/, '$1s'),
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    PermissionService,
    LoginThrottleService,
  ],
  controllers: [AuthController, UsersController, RolesController],
  exports: [AuthService, PermissionService, TypeOrmModule],
})
export class AuthModule {}
