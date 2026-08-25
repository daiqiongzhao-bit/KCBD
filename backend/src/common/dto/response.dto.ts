/**
 * 统一响应结构：{ code, data, message }
 * 成功 code=0；业务/校验失败 code>0。
 */
export interface ApiResponse<T> {
  code: number;
  data: T | null;
  message: string;
}

export class ResponseDto<T> {
  code = 0;
  data: T | null = null;
  message = 'ok';
}
