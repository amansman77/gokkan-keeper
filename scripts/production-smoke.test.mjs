import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeProduction } from './production-smoke.mjs';
const headers = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000', 'Cache-Control': 'no-store', 'Content-Security-Policy': "frame-ancestors 'none'; frame-src https://challenges.cloudflare.com" };
const fixtureFetch = async (url, options = {}) => {
  if (options.method === 'OPTIONS') return new Response('blocked', { status: 403, headers });
  if (url.endsWith('/granaries')) return new Response('unauthorized', { status: 401, headers });
  if (url.endsWith('/health')) return Response.json({ status: 'ok' });
  if (url.endsWith('/portfolio')) return Response.json({ data: [] });
  return new Response('<html><script src="/assets/fixture.js"></script></html>', { headers });
};
test('production smoke only reads allowlisted targets and validates new assets and private guards', async () => {
  const calls = [];
  await smokeProduction('all', async (url, options) => {
    assert.ok([undefined, 'OPTIONS'].includes(options.method)); assert.equal(options.headers.Authorization, undefined);
    calls.push(url); return fixtureFetch(url, options);
  }, ['/assets/fixture.js'], 1);
  assert.ok(calls.some((url) => url.endsWith('/api/granaries')));
  assert.ok(calls.every((url) => ['gokkan-keeper.yetimates.com', 'gokkan-keeper-api-production.amansman77.workers.dev'].includes(new URL(url).hostname)));
});
test('smoke rejects wrong build assets, an exposed private route and network failures', async () => {
  await assert.rejects(smokeProduction('web', fixtureFetch, ['/assets/wrong.js'], 1));
  await assert.rejects(smokeProduction('api', async () => new Response('exposed'), [], 1));
  await assert.rejects(smokeProduction('all', async () => { throw new Error('offline'); }, [], 1));
});

test('smoke rejects missing security controls and trusted attacker preflights', async () => {
  await assert.rejects(smokeProduction('api', async (url, options) => {
    const response = await fixtureFetch(url, options); response.headers.delete('Cache-Control'); return response;
  }, [], 1), /cached/);
  await assert.rejects(smokeProduction('web', async (url, options) => {
    const response = await fixtureFetch(url, options); response.headers.delete('Content-Security-Policy'); return response;
  }, [], 1), /security headers/);
  await assert.rejects(smokeProduction('api', async (url, options) => {
    const response = await fixtureFetch(url, options);
    if (options.method === 'OPTIONS') response.headers.set('Access-Control-Allow-Origin', options.headers.Origin);
    return response;
  }, [], 1), /Untrusted origin/);
});
