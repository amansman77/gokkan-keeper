import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { D1Database } from '@cloudflare/workers-types';
import { createApp } from '../../src/app';
import { createSessionToken, registerSession } from '../../src/auth/session';
import type { Env } from '../../src/types';
import { memorySecurityDatabase } from './fixtures';
import type { PublicPortfolioRow } from '../../src/db/repositories/position-repository';

function fixture() {
  const queries: string[] = [];
  const row: PublicPortfolioRow = {
    id: 'position', granary_id: 'granary', granary_name: 'Public', granary_currency: 'KRW',
    market: null, name: 'Cash', symbol: 'KRW', asset_type: 'CASH', quantity: null,
    avg_cost: null, current_value: 5000, profit_loss: null, profit_loss_percent: 2,
    public_thesis: 'Published reasoning', public_order: 0, last_public_update: '2026-10-09T00:00:00Z',
  };
  // The double implements only the query path exercised by these HTTP tests.
  const securityDb = memorySecurityDatabase();
  const db = { prepare(sql: string) {
    if (sql.includes('gk_sessions') || sql.includes('gk_security_')) return securityDb.prepare(sql);
    queries.push(sql);
    return { all: async () => ({ results: [row] }) };
  } } as unknown as D1Database;
  const env: Env = { DB: db, GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
    ALLOWED_EMAIL: 'fixture@example.com', SESSION_SECRET: 'fixture-only-session-secret', API_SECRET: 'fixture-only-api-secret' };
  return { app: createApp(), env, queries };
}
void test('public portfolio aliases use an explicit published projection and protect owner routes', async () => {
  const { app, env, queries } = fixture();
  for (const path of ['/public/portfolio', '/api/public/portfolio']) {
    const response = await app.request(path, {}, env);
    assert.equal(response.status, 200);
    const body: unknown = await response.json();
    assert.ok(typeof body === 'object' && body !== null && 'data' in body && Array.isArray(body.data));
    assert.equal(body.data.length, 1);
    const serialized = JSON.stringify(body);
    assert.ok(serialized.includes('Published reasoning'));
    for (const privateField of ['quantity', 'avgCost', 'currentValue', 'owner', 'note']) {
      assert.ok(!serialized.includes(`"${privateField}"`));
    }
  }
  assert.ok(queries.every((sql) => sql.includes('WHERE p.is_public = 1') && !sql.includes('SELECT *')));
  assert.equal((await app.request('/health', {}, env)).status, 200);
  for (const path of ['/granaries', '/positions', '/api/positions']) {
    assert.equal((await app.request(path, {}, env)).status, 401);
  }
});
void test('automation notifications reject an owner cookie and require API-secret authentication', async () => {
  const { app, env } = fixture();
  const token = await createSessionToken(env.SESSION_SECRET, { sub: 'fixture-owner', email: env.ALLOWED_EMAIL });
  await registerSession(env, token);
  const cookieResponse = await app.request('/automation/discord-notify', {
    method: 'POST', headers: { Cookie: `gk_session=${token}`, Origin: 'https://gokkan-keeper.yetimates.com', 'Content-Type': 'application/json' },
  }, env);
  assert.equal(cookieResponse.status, 403);
  const secretResponse = await app.request('/automation/discord-notify', {
    method: 'POST', headers: { 'X-API-Secret': env.API_SECRET!, 'Content-Type': 'application/json' },
  }, env);
  // No webhook in the fixture: the authenticated caller reaches the handler but
  // cannot send a real message or perform external I/O.
  assert.equal(secretResponse.status, 503);
});
void test('CORS only allows the production origin and keeps headless credentials out of browser preflight', async () => {
  const { app, env } = fixture();
  const allowed = await app.request('/health', { headers: { Origin: 'https://gokkan-keeper.yetimates.com' } }, env);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://gokkan-keeper.yetimates.com');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  const rejected = await app.request('/health', { headers: { Origin: 'https://untrusted.example' } }, env);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  const preflight = await app.request('/automation/discord-notify', {
    method: 'OPTIONS', headers: { Origin: 'https://gokkan-keeper.yetimates.com', 'Access-Control-Request-Headers': 'X-API-Secret' },
  }, env);
  assert.ok(!preflight.headers.get('access-control-allow-headers')?.toLowerCase().includes('x-api-secret'));
});
