import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { readSessionFromCookie } from '../auth/session';

function isPublicPath(pathname: string, method: string): boolean {
  if (pathname === '/health') return true;
  if (pathname === '/auth/google') return true;
  if (pathname === '/auth/logout') return true;
  if (pathname === '/auth/me') return true;
  if (pathname === '/public' || pathname.startsWith('/public/')) return true;
  if (pathname === '/api/public' || pathname.startsWith('/api/public/')) return true;

  // Public Judgment Archive: read-only access for anonymous users.
  if (method === 'GET' && (pathname === '/judgment-diary' || pathname.startsWith('/judgment-diary/'))) {
    return true;
  }

  return false;
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Let CORS preflight pass without auth check.
  if (c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  if (isPublicPath(c.req.path, c.req.method)) {
    await next();
    return;
  }

  c.header('X-Robots-Tag', 'noindex, nofollow');
  if (!c.env.SESSION_SECRET) {
    return c.json({ error: 'SESSION_SECRET not configured' }, 500);
  }

  const session = await readSessionFromCookie(c.req.raw, c.env.SESSION_SECRET);
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
}
