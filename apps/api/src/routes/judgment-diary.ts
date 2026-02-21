import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import {
  CreateJudgmentDiaryEntrySchema,
  UpdateJudgmentDiaryEntrySchema,
  JUDGMENT_ACTIONS,
  type JudgmentDiaryEntry,
} from '@gokkan-keeper/shared';

export const judgmentDiaryRouter = new Hono<{ Bindings: Env }>();
type JudgmentAction = JudgmentDiaryEntry['action'];

function isJudgmentAction(value: string): value is JudgmentAction {
  return (JUDGMENT_ACTIONS as readonly string[]).includes(value);
}

judgmentDiaryRouter.get('/', async (c) => {
  const db = new DBClient(c.env.DB);
  const actionQuery = c.req.query('action');
  const action = actionQuery && isJudgmentAction(actionQuery)
    ? actionQuery
    : undefined;

  const filters = {
    from: c.req.query('from') || undefined,
    to: c.req.query('to') || undefined,
    action,
    asset: c.req.query('asset') || undefined,
    strategyTag: c.req.query('strategyTag') || undefined,
    limit: c.req.query('limit') ? parseInt(c.req.query('limit') || '50', 10) : undefined,
  };

  const entries = await db.getJudgmentDiaryEntries(filters);
  return c.json(entries);
});

judgmentDiaryRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);

  const entry = await db.getJudgmentDiaryEntryById(id);
  if (!entry) {
    return c.json({ error: 'Judgment diary entry not found' }, 404);
  }

  return c.json(entry);
});

judgmentDiaryRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateJudgmentDiaryEntrySchema.parse(body);

    const db = new DBClient(c.env.DB);
    const entry = await db.createJudgmentDiaryEntry(validated);

    return c.json(entry, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

judgmentDiaryRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdateJudgmentDiaryEntrySchema.parse(body);

    const db = new DBClient(c.env.DB);
    const entry = await db.updateJudgmentDiaryEntry(id, validated);

    return c.json(entry);
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
