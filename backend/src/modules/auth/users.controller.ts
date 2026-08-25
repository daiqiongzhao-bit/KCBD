import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles.enum';
import { RegisterDto } from './dto/login.dto';

/** 用户管理（CRUD + 重置密码），仅管理员可写。 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(Role.ADMIN)
  @Get()
  list(
    @Query('keyword') keyword?: string,
    @Query('role') role?: Role,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.users.list({ keyword, role, page, size });
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: RegisterDto) {
    return this.users.create(dto);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: { display_name?: string; role?: Role; password?: string },
  ) {
    return this.users.update(Number(id), body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(Number(id));
  }

  @Roles(Role.ADMIN)
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body('newPassword') newPassword: string) {
    return this.users.resetPassword(Number(id), newPassword);
  }
}
