import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';

export const settingsRouter = new Hono<{ Bindings: Env }>();

settingsRouter.get('/', async (c) => {
  const db = new DBClient(c.env.DB);
  const settings = await db.getAllSettings();
  return c.json(settings);
});

settingsRouter.patch('/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json<{ value?: unknown }>();
  if (typeof body.value !== 'string' || body.value.trim() === '') {
    return c.json({ error: 'value must be a non-empty string' }, 400);
  }
  const db = new DBClient(c.env.DB);
  await db.setSetting(key, body.value);
  const settings = await db.getAllSettings();
  return c.json(settings);
});
