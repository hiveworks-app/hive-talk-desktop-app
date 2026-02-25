export class AuthError extends Error {
  code: 'TOKEN_EXPIRED' | 'UNAUTHORIZED';

  constructor(message: string, code: 'TOKEN_EXPIRED' | 'UNAUTHORIZED' = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export const isAuthError = (e: unknown, code?: AuthError['code']): e is AuthError => {
  if (!(e instanceof AuthError)) return false;
  if (!code) return true;
  return e.code === code;
};
