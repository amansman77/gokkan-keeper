import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { CreateSnapshotSchema, UpdateSnapshotSchema } from '@gokkan-keeper/shared';

export const snapshotsRouter = new Hono<{ Bindings: Env }>();

snapshotsRouter.get('/', async (c) => {
  const granaryId = c.req.query('granaryId');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  
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
    return c.json({ error: error.message || 'Internal server error' }, 500);
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
    
    // If date is being updated, check for unique constraint
    if (validated.date && validated.date !== existing.date) {
      // Check if another snapshot exists with the same granary_id and date
      const checkResult = await c.env.DB
        .prepare('SELECT id FROM gk_snapshots WHERE granary_id = ? AND date = ? AND id != ?')
        .bind(existing.granaryId, validated.date, id)
        .first();
      
      if (checkResult) {
        return c.json({ error: 'Snapshot already exists for this granary and date' }, 409);
      }
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
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

