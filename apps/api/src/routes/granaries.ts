import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { CreateGranarySchema, UpdateGranarySchema } from '@gokkan-keeper/shared';

export const granariesRouter = new Hono<{ Bindings: Env }>();

granariesRouter.get('/', async (c) => {
  const db = new DBClient(c.env.DB);
  const granaries = await db.getAllGranariesWithLatestSnapshot();
  return c.json(granaries);
});

granariesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  
  const granary = await db.getGranaryById(id);
  if (!granary) {
    return c.json({ error: 'Granary not found' }, 404);
  }

  const latestSnapshot = await db.getLatestSnapshotByGranaryId(id);
  return c.json({ ...granary, latestSnapshot });
});

granariesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateGranarySchema.parse(body);
    
    const db = new DBClient(c.env.DB);
    const granary = await db.createGranary(validated);
    
    return c.json(granary, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

granariesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdateGranarySchema.parse(body);
    
    const db = new DBClient(c.env.DB);
    
    // Verify granary exists
    const existing = await db.getGranaryById(id);
    if (!existing) {
      return c.json({ error: 'Granary not found' }, 404);
    }
    
    const granary = await db.updateGranary(id, validated);
    
    return c.json(granary);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

