import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/constants/roles.enum';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: '密码需同时包含字母和数字',
  })
  password: string;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  role?: Role;
}

export class ChangePasswordDto {
  @IsNotEmpty()
  oldPassword: string;

  @IsNotEmpty()
  @MinLength(8, { message: '密码至少 8 位' })
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: '密码需同时包含字母和数字',
  })
  newPassword: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  @MinLength(8, { message: '密码至少 8 位' })
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: '密码需同时包含字母和数字',
  })
  newPassword: string;
}
