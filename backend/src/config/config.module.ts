import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/**
 * 全局配置模块：加载 .env 并暴露 ConfigService。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '.env.example'],
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
