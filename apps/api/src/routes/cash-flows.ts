import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { CreateCashFlowSchema, UpdateCashFlowSchema } from '@gokkan-keeper/shared';

export const cashFlowsRouter = new Hono<{ Bindings: Env }>();

cashFlowsRouter.get('/', async (c) => {
  const granaryId = c.req.query('granaryId');
  if (!granaryId) {
    return c.json({ error: 'granaryId is required' }, 400);
  }
  const db = new DBClient(c.env.DB);
  const cashFlows = await db.getCashFlowsByGranaryId(granaryId);
  return c.json(cashFlows);
});

cashFlowsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateCashFlowSchema.parse(body);

    const db = new DBClient(c.env.DB);
    const granary = await db.getGranaryById(validated.granaryId);
    if (!granary) {
      return c.json({ error: 'Granary not found' }, 404);
    }

    const cashFlow = await db.createCashFlow(validated);
    return c.json(cashFlow, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

cashFlowsRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdateCashFlowSchema.parse(body);
    const db = new DBClient(c.env.DB);
    const cashFlow = await db.updateCashFlow(id, validated);
    return c.json(cashFlow);
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

cashFlowsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  await db.deleteCashFlow(id);
  return c.json({ ok: true });
});
