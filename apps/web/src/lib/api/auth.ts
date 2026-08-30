import { fetchAuthApi } from './client';

interface AuthUser {
  email: string;
  sub?: string;
}

interface AuthMeResponse {
  authenticated: boolean;
  user?: AuthUser;
}

interface GoogleLoginResponse {
  ok: boolean;
  next: string;
  user: AuthUser;
}

export const loginWithGoogle = (credential: string, next?: string) =>
  fetchAuthApi<GoogleLoginResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential, next }),
  });

export const getAuthMe = () => fetchAuthApi<AuthMeResponse>('/auth/me', { method: 'GET' });

export const logoutAuth = () =>
  fetchAuthApi<{ ok: boolean }>('/auth/logout', { method: 'POST' });
