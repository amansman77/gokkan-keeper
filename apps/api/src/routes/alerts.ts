import { Hono } from 'hono';
import type { Env } from '../types';
import { runAlertEngine } from '../services/alert-engine';
import { DBClient } from '../db/client';
import { parseLimit } from '../utils/query';

export const alertsRouter = new Hono<{ Bindings: Env }>();

alertsRouter.get('/', async (c) => {
  const db = new DBClient(c.env.DB);
  const limit = parseLimit(c.req.query('limit'), 50, 200);
  const entries = await db.getAlertLog(limit);
  return c.json(entries);
});

alertsRouter.post('/run/:mode', async (c) => {
  const mode = c.req.param('mode');
  if (mode !== 'daily' && mode !== 'weekly') {
    return c.json({ error: 'mode must be daily or weekly' }, 400);
  }
  try {
    const result = await runAlertEngine(c.env, mode);
    return c.json({ ok: true, ...result });
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});
