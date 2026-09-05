import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const automationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_CONTENT_LENGTH = 1900; // Discord message content limit is 2000

// Relays a message (optionally with a text file attachment) to the configured
// Discord webhook. Restricted to X-API-Secret callers only — this exists for
// scheduled cloud agents (e.g. the weekly candidate-pool report) that have no
// browser session, not for interactive/session-authenticated use.
automationRouter.post('/discord-notify', async (c) => {
  if (!c.get('authViaApiSecret')) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (!c.env.DISCORD_WEBHOOK_URL) {
    return c.json({ error: 'Discord webhook not configured' }, 503);
  }

  const body = await c.req.json<{ content?: string; fileName?: string; fileContent?: string }>();
  if (!body.content || typeof body.content !== 'string') {
    return c.json({ error: 'content is required' }, 400);
  }
  if (body.content.length > MAX_CONTENT_LENGTH) {
    return c.json({ error: `content must be ${MAX_CONTENT_LENGTH} characters or fewer` }, 400);
  }

  let response: Response;
  if (body.fileContent) {
    const form = new FormData();
    form.set('payload_json', JSON.stringify({ username: 'Gokkan Keeper', content: body.content }));
    form.set(
      'files[0]',
      new Blob([body.fileContent], { type: 'text/plain; charset=utf-8' }),
      (body.fileName || 'report.txt').slice(0, 100),
    );
    response = await fetch(c.env.DISCORD_WEBHOOK_URL, { method: 'POST', body: form });
  } else {
    response = await fetch(c.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Gokkan Keeper', content: body.content }),
    });
  }

  if (!response.ok) {
    return c.json({ error: 'Discord notification failed' }, 502);
  }
  return c.json({ ok: true });
});
