import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { CreatePositionSchema, UpdatePositionSchema } from '@gokkan-keeper/shared';

export const positionsRouter = new Hono<{ Bindings: Env }>();

function validatePublicPositionInput(data: {
  isPublic?: boolean;
  publicThesis?: string | null;
  weightPercent?: number | null;
  quantity?: number | null;
  avgCost?: number | null;
  currentValue?: number | null;
}) {
  if (!data.isPublic) return null;

  if (!data.publicThesis || !data.publicThesis.trim()) {
    return 'Public position requires publicThesis.';
  }

  const hasCurrentValue = data.currentValue !== null && data.currentValue !== undefined;
  const hasWeightPercent = data.weightPercent !== null && data.weightPercent !== undefined;
  const hasCostBasis =
    data.quantity !== null &&
    data.quantity !== undefined &&
    data.avgCost !== null &&
    data.avgCost !== undefined;

  if (!hasCurrentValue && !hasCostBasis && !hasWeightPercent) {
    return 'Public position requires weightPercent, currentValue, or (quantity and avgCost).';
  }

  return null;
}

positionsRouter.get('/', async (c) => {
  const granaryId = c.req.query('granary_id');
  const db = new DBClient(c.env.DB);
  const positions = await db.getPositions(granaryId || undefined);
  return c.json(positions);
});

positionsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  const position = await db.getPositionById(id);

  if (!position) {
    return c.json({ error: 'Position not found' }, 404);
  }

  return c.json(position);
});

positionsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreatePositionSchema.parse(body);

    const publicValidationError = validatePublicPositionInput(validated);
    if (publicValidationError) {
      return c.json({ error: publicValidationError }, 400);
    }

    const db = new DBClient(c.env.DB);

    if (validated.granaryId) {
      const granary = await db.getGranaryById(validated.granaryId);
      if (!granary) {
        return c.json({ error: 'Granary not found' }, 404);
      }
    }

    const position = await db.createPosition(validated);
    return c.json(position, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

positionsRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdatePositionSchema.parse(body);

    const db = new DBClient(c.env.DB);
    const existing = await db.getPositionById(id);
    if (!existing) {
      return c.json({ error: 'Position not found' }, 404);
    }

    const merged = {
      ...existing,
      ...validated,
    };

    const publicValidationError = validatePublicPositionInput(merged);
    if (publicValidationError) {
      return c.json({ error: publicValidationError }, 400);
    }

    if (validated.granaryId !== undefined && validated.granaryId !== null) {
      const granary = await db.getGranaryById(validated.granaryId);
      if (!granary) {
        return c.json({ error: 'Granary not found' }, 404);
      }
    }

    const updated = await db.updatePosition(id, validated);
    return c.json(updated);
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

positionsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  const existing = await db.getPositionById(id);

  if (!existing) {
    return c.json({ error: 'Position not found' }, 404);
  }

  await db.deletePosition(id);
  return c.json({ ok: true });
});
