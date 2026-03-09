import { LoginRequestProps, LoginResponseProps } from '@/features/auth/type';
import { publicRequest, request } from '@/shared/api';

export const apiLogin = (data: LoginRequestProps) =>
  publicRequest<LoginResponseProps>('/app/login', {
    method: 'POST',
    body: data,
  });

export const apiLogout = () => request('/app/logout', { method: 'POST' });
