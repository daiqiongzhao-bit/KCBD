import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

/**
 * 统一异常过滤器：将任意异常转换为 { code, data, message }。
 * 若为校验异常且携带 issues，则透传到 data.issues。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // multer 文件上传错误（如超出 limits.fileSize）→ 400，带明确提示（P1-5）
    if (exception instanceof MulterError) {
      const message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? '文件大小超过 10MB 限制'
          : `文件上传失败：${exception.message}`;
      res.status(HttpStatus.BAD_REQUEST).json({
        code: HttpStatus.BAD_REQUEST,
        data: null,
        message,
      });
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 记录未捕获异常堆栈，便于排查（P1-5）
    if (!(exception instanceof HttpException) || status >= 500) {
      // eslint-disable-next-line no-console
      console.error('[HttpExceptionFilter]', exception);
    }

    let message = '服务内部错误';
    let data: Record<string, unknown> | null = null;

    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const r = resp as Record<string, unknown>;
        if (typeof r.message === 'string') {
          message = r.message;
        } else if (Array.isArray(r.message)) {
          message = (r.message as unknown[]).join('；');
        }
        if (r.issues) data = { issues: r.issues };
        if (r.error && !data) data = { error: r.error };
      }
    }

    res.status(status).json({ code: status, data, message });
  }
}
