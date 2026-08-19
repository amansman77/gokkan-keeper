import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { CreateGranarySchema, UpdateGranarySchema } from '@gokkan-keeper/shared';
import type { Granary } from '@gokkan-keeper/shared';
import { enrichPositionsWithLiveQuotes } from '../services/market-price';
import { getTechnicalIndicatorSeries } from '../services/technical-indicators';

export const granariesRouter = new Hono<{ Bindings: Env }>();

async function buildGranaryExport(db: DBClient, env: Env, granary: Granary, includeIndicators: boolean) {
  const [latestSnapshot, positions] = await Promise.all([
    db.getLatestSnapshotByGranaryId(granary.id),
    db.getPositions(granary.id),
  ]);

  const hydratedPositions = await enrichPositionsWithLiveQuotes(positions, env);

  let indicators: Record<string, { '1d': unknown; '1wk': unknown }> = {};
  if (includeIndicators) {
    const indicatorResults = await Promise.all(
      hydratedPositions.flatMap((p) => [
        getTechnicalIndicatorSeries(p.symbol, p.market ?? null, '1d', 7, env.YAHOO_FINANCE_API_BASE_URL, env.DB)
          .then((r) => ({ positionId: p.id, interval: '1d' as const, data: r })),
        getTechnicalIndicatorSeries(p.symbol, p.market ?? null, '1wk', 4, env.YAHOO_FINANCE_API_BASE_URL, env.DB)
          .then((r) => ({ positionId: p.id, interval: '1wk' as const, data: r })),
      ]),
    );
    for (const { positionId, interval, data } of indicatorResults) {
      if (!indicators[positionId]) indicators[positionId] = { '1d': [], '1wk': [] };
      indicators[positionId][interval] = data;
    }
  }

  return { granary, latestSnapshot, positions: hydratedPositions, indicators };
}

granariesRouter.get('/', async (c) => {
  const db = new DBClient(c.env.DB);
  const granaries = await db.getAllGranariesWithLatestSnapshot();
  return c.json(granaries);
});

// Registered before /:id so "export" isn't swallowed as an :id value.
// Indicators are omitted here (unlike the per-granary export) because fetching
// 1d+1wk series for every position across every granary in one invocation can
// exceed the Workers subrequest limit. Use /:id/export for indicator detail.
granariesRouter.get('/export', async (c) => {
  const db = new DBClient(c.env.DB);
  const granaries = await db.getAllGranaries();

  const exports = await Promise.all(granaries.map((granary) => buildGranaryExport(db, c.env, granary, false)));

  return c.json({
    exportedAt: new Date().toISOString(),
    granaries: exports,
  });
});

granariesRouter.get('/:id/export', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);

  const granary = await db.getGranaryById(id);
  if (!granary) {
    return c.json({ error: 'Granary not found' }, 404);
  }

  const result = await buildGranaryExport(db, c.env, granary, true);

  return c.json({
    exportedAt: new Date().toISOString(),
    ...result,
  });
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
