import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 提取当前登录用户（由 JwtStrategy.validate 注入到 req.user）。
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
