import type { Env } from '../types';

export function isTrustedOrigin(origin: string | undefined, env: Pick<Env, 'NODE_ENV'>): boolean {
  if (!origin) return false;
  if (['https://gokkan-keeper.yetimates.com', 'capacitor://localhost', 'https://localhost'].includes(origin)) return true;
  if (env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch { return false; }
}

export function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method);
}
