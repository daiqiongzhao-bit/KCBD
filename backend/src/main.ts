import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Reflector } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validationPipe } from './common/pipes/validation.pipe';
import { seedDatabase } from './database/seeds/seed';
import { PermissionService } from './modules/auth/permission.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 全局路由前缀 /api，与前端 baseURL（/api）及 nginx 反代路径保持一致
  app.setGlobalPrefix('api');

  app.useGlobalPipes(validationPipe);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const reflector = app.get(Reflector);
  const permissions = app.get(PermissionService);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector, permissions),
  );

  // CORS 白名单：从 env FRONTEND_URL 读取（支持逗号分隔多个来源），
  // 未配置时回落本地开发地址（P1-5：不再使用 origin:'*'+credentials 的非法组合）。
  const rawOrigins = config.get<string>('FRONTEND_URL', '');
  const origins = rawOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedOrigins =
    origins.length > 0
      ? origins
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  app.enableCors({
    origin: (origin, callback) => {
      // 允许无 Origin 的请求（curl / 同源 / 内部服务）
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  });

  // 自动建表（synchronize）+ 种子数据
  const ds = app.get(DataSource);
  await seedDatabase(ds);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`库存对账后端已启动: http://localhost:${port}`);
}

bootstrap();
