import type { Context } from 'hono';

export function internalError(c: Context, error: unknown) {
  const requestId = c.get('requestId') as string;
  console.error(JSON.stringify({ event: 'request_failed', requestId, category: error instanceof Error ? error.name : 'UnknownError' }));
  return c.json({ error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', requestId }, 500);
}
