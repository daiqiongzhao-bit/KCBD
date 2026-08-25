import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Response } from 'express';
import { ResponseDto } from '../dto/response.dto';

/**
 * 统一成功响应拦截器：自动包裹为 { code:0, data, message:'ok' }。
 * 对文件下载（已设置 Content-Disposition / spreadsheet / octet-stream）直接透传原始内容。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        // 二进制下载（Buffer）一律原样透传，绝不包裹为 JSON，避免 xlsx 等文件被序列化成 {"type":"Buffer",...}
        if (Buffer.isBuffer(data)) {
          return data;
        }
        const contentType = res.getHeader('Content-Type');
        const isFile =
          res.getHeader('Content-Disposition') !== undefined ||
          (typeof contentType === 'string' &&
            (contentType.includes('spreadsheet') ||
              contentType.includes('octet-stream')));
        if (isFile) {
          return data;
        }
        const result = new ResponseDto<T>();
        result.data = data ?? null;
        result.message = 'ok';
        return result;
      }),
    );
  }
}
