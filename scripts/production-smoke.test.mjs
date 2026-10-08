import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeProduction } from './production-smoke.mjs';
const fixtureFetch = async (url) => {
  if (url.endsWith('/granaries')) return new Response('unauthorized', { status: 401 });
  if (url.endsWith('/health')) return Response.json({ status: 'ok' });
  if (url.endsWith('/portfolio')) return Response.json({ data: [] });
  return new Response('<html><script src="/assets/fixture.js"></script></html>');
};
test('production smoke only reads allowlisted targets and validates new assets and private guards', async () => {
  const calls = [];
  await smokeProduction('all', async (url, options) => {
    assert.equal(options.method, undefined); assert.equal(options.headers.Authorization, undefined);
    calls.push(url); return fixtureFetch(url);
  }, ['/assets/fixture.js'], 1);
  assert.ok(calls.some((url) => url.endsWith('/api/granaries')));
  assert.ok(calls.every((url) => ['gokkan-keeper.yetimates.com', 'gokkan-keeper-api-production.amansman77.workers.dev'].includes(new URL(url).hostname)));
});
test('smoke rejects wrong build assets, an exposed private route and network failures', async () => {
  await assert.rejects(smokeProduction('web', fixtureFetch, ['/assets/wrong.js'], 1));
  await assert.rejects(smokeProduction('api', async () => new Response('exposed'), [], 1));
  await assert.rejects(smokeProduction('all', async () => { throw new Error('offline'); }, [], 1));
});
