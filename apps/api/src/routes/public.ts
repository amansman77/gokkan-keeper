import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { handleConsultingRequest } from '../services/consulting-request';

export const publicRouter = new Hono<{ Bindings: Env }>();

publicRouter.get('/portfolio', async (c) => {
  const db = new DBClient(c.env.DB);
  const portfolio = await db.getPublicPortfolioEntries(c.env);
  return c.json(portfolio);
});

publicRouter.post('/consulting-request', async (c) => {
  try {
    const result = await handleConsultingRequest(c.env, await c.req.formData());
    return c.json(result, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: '입력값을 다시 확인해 주세요.', details: error.errors }, 400);
    }
    if (typeof error.status === 'number') {
      return c.json({ error: error.message || '요청 처리에 실패했습니다.' }, error.status);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});
