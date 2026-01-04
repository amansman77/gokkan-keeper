import type { Context, Next } from 'hono';
import type { Env } from '../types';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const apiSecret = c.env.API_SECRET;
  const providedSecret = c.req.header('X-API-Secret');

  if (!apiSecret) {
    return c.json({ error: 'API_SECRET not configured' }, 500);
  }

  if (!providedSecret || providedSecret !== apiSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
}

