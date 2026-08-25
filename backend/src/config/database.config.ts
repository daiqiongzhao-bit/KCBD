import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * 返回 TypeORM 数据源配置。
 * 使用 synchronize 在开发/部署时自动根据实体建表（含唯一约束与索引），
 * 生产环境若需严格迁移可改为 migrationsRun。
 */
export const getDatabaseConfig = (
  config?: ConfigService,
): TypeOrmModuleOptions => {
  const get = <T>(key: string, fallback: T): T => {
    if (config) {
      return config.get<T>(key, fallback);
    }
    const env = process.env[key];
    if (env === undefined) return fallback;
    if (typeof fallback === 'number') return Number(env) as T;
    return env as T;
  };

  return {
    type: 'postgres',
    host: get<string>('DB_HOST', 'localhost'),
    port: get<number>('DB_PORT', 5432),
    username: get<string>('DB_USERNAME', 'postgres'),
    password: get<string>('DB_PASSWORD', 'postgres'),
    database: get<string>('DB_NAME', 'inventory_reconcile'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true,
    logging: false,
    extra: {
      max: 10,
      connectionTimeoutMillis: 5000,
    },
  };
};
