import { internalError } from '../http/errors';
import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { CreateSnapshotSchema, UpdateSnapshotSchema } from '@gokkan-keeper/shared';
import { parseLimit } from '../utils/query';

export const snapshotsRouter = new Hono<{ Bindings: Env }>();

snapshotsRouter.get('/', async (c) => {
  const granaryId = c.req.query('granaryId');
  const limit = parseLimit(c.req.query('limit'), 50, 200);
  
  const db = new DBClient(c.env.DB);
  
  if (granaryId) {
    const snapshots = await db.getSnapshotsByGranaryId(granaryId, limit);
    return c.json(snapshots);
  }
  
  const snapshots = await db.getAllSnapshots(limit);
  return c.json(snapshots);
});

snapshotsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  
  const snapshot = await db.getSnapshotById(id);
  if (!snapshot) {
    return c.json({ error: 'Snapshot not found' }, 404);
  }
  
  return c.json(snapshot);
});

snapshotsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateSnapshotSchema.parse(body);
    
    const db = new DBClient(c.env.DB);
    
    // Verify granary exists
    const granary = await db.getGranaryById(validated.granaryId);
    if (!granary) {
      return c.json({ error: 'Granary not found' }, 404);
    }
    
    const snapshot = await db.createSnapshot(validated);
    
    return c.json(snapshot, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    if (error.message?.includes('already exists')) {
      return c.json({ error: error.message }, 409);
    }
    return internalError(c, error);
  }
});

snapshotsRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdateSnapshotSchema.parse(body);
    
    const db = new DBClient(c.env.DB);
    
    // Verify snapshot exists
    const existing = await db.getSnapshotById(id);
    if (!existing) {
      return c.json({ error: 'Snapshot not found' }, 404);
    }
    
    const snapshot = await db.updateSnapshot(id, validated);
    
    return c.json(snapshot);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    if (error.message?.includes('already exists')) {
      return c.json({ error: error.message }, 409);
    }
    return internalError(c, error);
  }
});
