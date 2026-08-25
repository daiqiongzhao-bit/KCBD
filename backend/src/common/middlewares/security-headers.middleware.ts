import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * 安全响应头中间件（等效 helmet 核心项，零依赖）：
 * - X-Frame-Options: DENY 防点击劫持（前端 iframe 嵌入被拒）
 * - X-Content-Type-Options: nosniff 防 MIME 嗅探
 * - Referrer-Policy: strict-origin-when-cross-origin 防 Referer 泄露
 * - X-XSS-Protection: 1; mode=block 旧浏览器 XSS 过滤
 * - Permissions-Policy: 限制摄像头/麦克风/定位等敏感权限
 * - Cache-Control: no-store 敏感接口不缓存
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    // API 响应默认不缓存（敏感数据）
    res.setHeader('Cache-Control', 'no-store');
    next();
  }
}
