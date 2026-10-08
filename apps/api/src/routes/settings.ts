import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { AssetGoalPlanSchema, ASSET_GOAL_SETTING_KEY } from '@gokkan-keeper/shared';

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
  if (key === ASSET_GOAL_SETTING_KEY) {
    try {
      if (!AssetGoalPlanSchema.safeParse(JSON.parse(body.value)).success) return c.json({ error: 'Invalid asset goal plan' }, 400);
    } catch { return c.json({ error: 'Invalid asset goal plan' }, 400); }
  }
  const db = new DBClient(c.env.DB);
  if (key === 'weekly_report_rsi_overbought' || key === 'weekly_report_rsi_oversold') {
    let value: unknown;
    try { value = JSON.parse(body.value); } catch { return c.json({ error: 'Invalid RSI threshold' }, 400); }
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 100) return c.json({ error: 'RSI threshold must be between 0 and 100' }, 400);
  }
  try { await db.setSetting(key, body.value); }
  catch (error) {
    if (error instanceof Error && error.message.includes('rsi_threshold_invalid')) return c.json({ error: '과매도 기준은 과매수 기준보다 작아야 합니다.' }, 400);
    throw error;
  }
  const settings = await db.getAllSettings();
  return c.json(settings);
});
