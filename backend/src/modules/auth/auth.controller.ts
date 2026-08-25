import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/constants/roles.enum';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/login.dto';

/** 认证与账号管理（登录/登出/注册/改密/重置）。 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req as any).ip || (req as any).socket?.remoteAddress || '';
    return this.auth.login(dto, ip);
  }

  /** 自助注册（公开）：默认创建 warehouse 角色；可用 env ENABLE_SELF_REGISTER=false 关闭。 */
  @Public()
  @Post('self-register')
  selfRegister(@Body() dto: RegisterDto) {
    const enabled = (process.env.ENABLE_SELF_REGISTER || 'true') === 'true';
    if (!enabled) {
      return { code: 403, message: '暂未开放自助注册，请联系管理员创建账号' };
    }
    return this.auth.selfRegister(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return null;
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@CurrentUser() user: { id: number }) {
    return this.auth.findById(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('register')
  register(@Body() dto: RegisterDto, @CurrentUser() user: { role: Role }) {
    return this.auth.register(dto, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.auth.changePassword(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('reset-password/:id')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: { role: Role },
  ) {
    return this.auth.resetPassword(Number(id), dto, user.role);
  }
}
