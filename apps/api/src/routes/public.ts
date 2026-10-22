import { internalError } from '../http/errors';
import { Hono } from 'hono';
import type { Env } from '../types';
import { getPublicPortfolio } from '../services/public-portfolio';
import { handleConsultingRequest, ConsultingRequestError } from '../services/consulting-request';

export const publicRouter = new Hono<{ Bindings: Env }>();

publicRouter.get('/portfolio', async (c) => {
  const portfolio = await getPublicPortfolio(c.env);
  return c.json(portfolio);
});

publicRouter.post('/consulting-request', async (c) => {
  try {
    const result = await handleConsultingRequest(c.env, await c.req.formData());
    return c.json(result, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError' && 'issues' in error) {
      return c.json({ error: '입력값을 다시 확인해 주세요.', details: error.issues }, 400);
    }
    if (error instanceof ConsultingRequestError) {
      return c.json({ error: error.message || '요청 처리에 실패했습니다.' }, error.status);
    }
    return internalError(c, error);
  }
});
