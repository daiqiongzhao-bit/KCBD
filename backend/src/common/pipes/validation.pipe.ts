import { ValidationPipe } from '@nestjs/common';

/**
 * 全局校验管道：开启 transform 与隐式类型转换，便于 Query DTO 解析数字。
 */
export const validationPipe = new ValidationPipe({
  transform: true,
  transformOptions: { enableImplicitConversion: true },
  whitelist: false,
  forbidUnknownValues: false,
});
