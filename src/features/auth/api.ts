import { LoginRequestProps, LoginResponseProps } from '@/features/auth/type';
import { request } from '@/shared/api';

export const apiLogin = (data: LoginRequestProps) =>
  request<LoginResponseProps>('/app/login', {
    method: 'POST',
    body: data,
  });

export const apiLogout = () => request('/app/logout', { method: 'POST' });
