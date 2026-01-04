import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import type { StatusSummary } from '@gokkan-keeper/shared';

export const statusRouter = new Hono<{ Bindings: Env }>();

statusRouter.get('/', async (c) => {
  const db = new DBClient(c.env.DB);
  
  const [granaries, snapshots, oldestUnupdated] = await Promise.all([
    db.getAllGranaries(),
    db.getAllSnapshots(10),
    db.getOldestUnupdatedGranary(),
  ]);

  const summary: StatusSummary = {
    totalGranaries: granaries.length,
    totalSnapshots: snapshots.length,
    oldestUnupdatedGranary: oldestUnupdated || undefined,
    recentSnapshots: snapshots,
  };

  return c.json(summary);
});

