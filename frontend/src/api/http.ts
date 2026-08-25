import axios, { AxiosInstance } from 'axios';
import { ElMessage } from 'element-plus';
import { getToken, clearAuth } from '@/utils/auth';

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

http.interceptors.response.use(
  (resp) => {
    const body = resp.data;
    // 文件下载（Blob）直接透传
    if (body instanceof Blob) return body as unknown as Promise<unknown>;
    if (body && typeof body === 'object' && 'code' in body) {
      if ((body as { code: number }).code === 0) {
        return (body as { data: unknown }).data as unknown;
      }
      ElMessage.error((body as { message: string }).message || '请求失败');
      return Promise.reject(body);
    }
    return body;
  },
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status === 401) {
      clearAuth();
      ElMessage.error('登录已过期，请重新登录');
      setTimeout(() => {
        location.href = '/login';
      }, 500);
    } else {
      ElMessage.error(data?.message || error.message || '网络错误');
    }
    return Promise.reject(data || error);
  },
);

export const get = <T = unknown>(
  url: string,
  config?: Record<string, unknown>,
): Promise<T> => http.get(url, config) as unknown as Promise<T>;

export const post = <T = unknown>(
  url: string,
  data?: unknown,
  config?: Record<string, unknown>,
): Promise<T> => http.post(url, data, config) as unknown as Promise<T>;

export const put = <T = unknown>(
  url: string,
  data?: unknown,
  config?: Record<string, unknown>,
): Promise<T> => http.put(url, data, config) as unknown as Promise<T>;

export const del = <T = unknown>(
  url: string,
  config?: Record<string, unknown>,
): Promise<T> => http.delete(url, config) as unknown as Promise<T>;

export default http;
