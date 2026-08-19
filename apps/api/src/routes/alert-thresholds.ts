import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { CreateAlertThresholdSchema, UpdateAlertThresholdSchema } from '@gokkan-keeper/shared';

export const alertThresholdsRouter = new Hono<{ Bindings: Env }>();

alertThresholdsRouter.get('/', async (c) => {
  const db = new DBClient(c.env.DB);
  const thresholds = await db.getAlertThresholds();
  return c.json(thresholds);
});

alertThresholdsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateAlertThresholdSchema.parse(body);
    const db = new DBClient(c.env.DB);
    const threshold = await db.createAlertThreshold(validated);
    return c.json(threshold, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

alertThresholdsRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdateAlertThresholdSchema.parse(body);
    const db = new DBClient(c.env.DB);
    const threshold = await db.updateAlertThreshold(id, validated);
    return c.json(threshold);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    if (error.message?.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

alertThresholdsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  await db.deleteAlertThreshold(id);
  return c.json({ ok: true });
});
