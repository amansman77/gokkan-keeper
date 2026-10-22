import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types';
import { readActiveSession } from '../auth/session';
import { authenticateAutomation, permitsAutomation } from '../auth/automation';
import { isSafeMethod, isTrustedOrigin } from '../http/origins';
import { isAnonymousRequestAtAuthBoundary } from '../http/route-access';

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  // Let CORS preflight pass without auth check.
  if (c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  if (c.req.method === 'GET' && isAnonymousRequestAtAuthBoundary(c.req.path, c.req.method)) { await next(); return; }

  // Shared-secret auth for headless/automated callers (e.g. scheduled agents)
  // that can't hold a browser session cookie. Not exposed via CORS allowHeaders,
  // so it's unreachable from browser JS — server-to-server only.
  const apiSecretHeader = c.req.header('X-API-Secret');
  if (apiSecretHeader) {
    const caller = await authenticateAutomation(apiSecretHeader, c.env);
    if (!caller) return c.json({ error: 'Unauthorized' }, 401);
    c.set('actor', `automation:${caller.id}`);
    if (!permitsAutomation(caller, c.req.path, c.req.method)) return c.json({ error: 'Forbidden' }, 403);
    c.set('authViaApiSecret', true);
    await next();
    return;
  }

  if (isAnonymousRequestAtAuthBoundary(c.req.path, c.req.method)) {
    await next();
    return;
  }

  c.header('X-Robots-Tag', 'noindex, nofollow');
  if (!c.env.SESSION_SECRET) {
    return c.json({ error: 'SESSION_SECRET not configured' }, 500);
  }

  const session = await readActiveSession(c.req.raw, c.env);
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('actor', 'owner');
  if (!isSafeMethod(c.req.method) && !isTrustedOrigin(c.req.header('Origin'), c.env)) return c.json({ error: 'Untrusted origin' }, 403);

  await next();
}
