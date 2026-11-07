import { Hono } from 'hono';
import { DiscordNotifySchema } from '@gokkan-keeper/shared';
import type { Env, Variables } from '../types';

export const automationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Relays a message (text, embeds, or both; optionally with a text file
// attachment) to the configured Discord webhook. Restricted to X-API-Secret callers only — this exists for
// scheduled cloud agents (e.g. the weekly candidate-pool report) that have no
// browser session, not for interactive/session-authenticated use.
automationRouter.post('/discord-notify', async (c) => {
  if (!c.get('authViaApiSecret')) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (!c.env.DISCORD_WEBHOOK_URL) {
    return c.json({ error: 'Discord webhook not configured' }, 503);
  }

  const parsed = DiscordNotifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
  }
  const body = parsed.data;
  const message = { username: 'Gokkan Keeper', allowed_mentions: { parse: [] }, content: body.content, embeds: body.embeds };

  let response: Response;
  if (body.fileContent) {
    const form = new FormData();
    form.set('payload_json', JSON.stringify(message));
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
      body: JSON.stringify(message),
    });
  }

  if (!response.ok) {
    return c.json({ error: 'Discord notification failed' }, 502);
  }
  return c.json({ ok: true });
});
