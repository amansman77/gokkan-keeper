import { Hono } from 'hono';
import type { Env } from '../types';
import { normalizeInternalPath } from '@gokkan-keeper/shared';
import { clearSessionCookie, createSessionToken, readSessionFromCookie, setSessionCookie } from '../auth/session';

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

    const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!tokenInfoResponse.ok) {
      return c.json({ error: 'Invalid Google credential' }, 401);
    }

    const tokenInfo = await tokenInfoResponse.json() as {
      aud?: string;
      email?: string;
      email_verified?: string;
      sub?: string;
    };

    if (tokenInfo.aud !== c.env.GOOGLE_CLIENT_ID) {
      return c.json({ error: 'Invalid Google audience' }, 401);
    }

    if (tokenInfo.email_verified !== 'true') {
      return c.json({ error: 'Unverified Google email' }, 401);
    }

    if (!tokenInfo.email || tokenInfo.email !== c.env.ALLOWED_EMAIL) {
      return c.json({ error: 'Unauthorized account' }, 401);
    }

    if (c.env.ALLOWED_SUB && tokenInfo.sub !== c.env.ALLOWED_SUB) {
      return c.json({ error: 'Unauthorized account subject' }, 401);
    }

    if (!tokenInfo.sub) {
      return c.json({ error: 'Invalid Google subject' }, 401);
    }

    const sessionToken = await createSessionToken(c.env.SESSION_SECRET, {
      sub: tokenInfo.sub,
      email: tokenInfo.email,
    });

    setSessionCookie(c, sessionToken);
    return c.json({ ok: true, next, user: { email: tokenInfo.email } });
  } catch {
    return c.json({ error: '로그인에 실패했습니다.' }, 401);
  }
});

authRouter.get('/me', async (c) => {
  if (!c.env.SESSION_SECRET) {
    return c.json({ authenticated: false });
  }

  const session = await readSessionFromCookie(c.req.raw, c.env.SESSION_SECRET);
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

authRouter.post('/logout', (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});
