import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

/**
 * 对框架 ConfigService 的薄封装，提供带默认值的强类型读取。
 */
@Injectable()
export class ConfigService {
  constructor(private readonly nest: NestConfigService) {}

  get<T>(key: string, defaultValue?: T): T {
    return this.nest.get<T>(key, defaultValue as T);
  }

  getString(key: string, defaultValue = ''): string {
    return this.nest.get<string>(key, defaultValue) ?? defaultValue;
  }

  getNumber(key: string, defaultValue = 0): number {
    const v = this.nest.get<string | number>(key);
    if (v === undefined || v === null || v === '') return defaultValue;
    return typeof v === 'number' ? v : Number(v);
  }
}
