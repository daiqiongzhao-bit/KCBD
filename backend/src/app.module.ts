import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from './config/config.module';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { UploadModule } from './modules/upload/upload.module';
import { ReconcileModule } from './modules/reconcile/reconcile.module';
import { NotifyModule } from './modules/notify/notify.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SecurityHeadersMiddleware } from './common/middlewares/security-headers.middleware';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => getDatabaseConfig(config),
    }),
    AuthModule,
    InventoryModule,
    UploadModule,
    ReconcileModule,
    NotifyModule,
    DashboardModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 安全响应头：对所有路由生效（含 /api 前缀下的全部接口）
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
  }
}
