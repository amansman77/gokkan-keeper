import { Hono } from 'hono';
import type { Env } from '../types';
import { normalizeInternalPath } from '@gokkan-keeper/shared';
import { clearSessionCookie, createSessionToken, readActiveSession, registerSession, setSessionCookie } from '../auth/session';

import { verifyGoogleCredential } from '../auth/google';
import { internalError } from '../http/errors';
import { SecurityRepository } from '../db/repositories/security-repository';

export const authRouter = new Hono<{ Bindings: Env }>();

authRouter.post('/google', async (c) => {
  try {
    const body = await c.req.json();
    const credential = typeof body?.credential === 'string' ? body.credential : '';
    const next = normalizeInternalPath(typeof body?.next === 'string' ? body.next : undefined);

    if (!credential) {
      return c.json({ error: 'Missing credential' }, 400);
    }

    if (!c.env.GOOGLE_CLIENT_ID || !c.env.ALLOWED_EMAIL || !c.env.SESSION_SECRET) {
      return c.json({ error: 'Auth environment is not configured' }, 500);
    }

    let identity;
    try { identity = await verifyGoogleCredential(credential, c.env); }
    catch { return c.json({ error: '로그인에 실패했습니다.' }, 401); }
    const sessionToken = await createSessionToken(c.env.SESSION_SECRET, identity);
    await registerSession(c.env, sessionToken);
    c.set('actor', 'owner');

    setSessionCookie(c, sessionToken);
    return c.json({ ok: true, next, user: { email: identity.email } });
  } catch (error) {
    if (error instanceof SyntaxError) return c.json({ error: 'Invalid JSON' }, 400);
    return internalError(c, error);
  }
});

authRouter.get('/me', async (c) => {
  if (!c.env.SESSION_SECRET) {
    return c.json({ authenticated: false });
  }

  const session = await readActiveSession(c.req.raw, c.env);
  if (!session) {
    return c.json({ authenticated: false });
  }

  return c.json({
    authenticated: true,
    user: {
      email: session.email,
      sub: session.sub,
    },
  });
});

authRouter.post('/logout', async (c) => {
  const session = await readActiveSession(c.req.raw, c.env);
  if (session) {
    await new SecurityRepository(c.env.DB).revokeSession(session.jti);
    c.set('actor', 'owner');
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});
