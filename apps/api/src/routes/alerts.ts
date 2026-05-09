import { Hono } from 'hono';
import type { Env } from '../types';
import { runAlertEngine } from '../services/alert-engine';

export const alertsRouter = new Hono<{ Bindings: Env }>();

alertsRouter.post('/run/:mode', async (c) => {
  const mode = c.req.param('mode');
  if (mode !== 'daily' && mode !== 'weekly') {
    return c.json({ error: 'mode must be daily or weekly' }, 400);
  }
  const result = await runAlertEngine(c.env, mode);
  return c.json({ ok: true, ...result });
});
