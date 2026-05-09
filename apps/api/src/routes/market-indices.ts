import { Hono } from 'hono';
import type { Env } from '../types';
import { getMarketIndices } from '../services/market-indices';

export const marketIndicesRouter = new Hono<{ Bindings: Env }>();

marketIndicesRouter.get('/', async (c) => {
  const indices = await getMarketIndices(c.env.YAHOO_FINANCE_API_BASE_URL, c.env.DB);
  return c.json({ indices, fetchedAt: new Date().toISOString() });
});
