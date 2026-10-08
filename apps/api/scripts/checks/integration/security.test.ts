import { attestProxyClient } from '@gokkan-keeper/shared';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness';

const origin = 'https://gokkan-keeper.yetimates.com';
void test('CSRF/CORS reject malicious or missing origins before writes; logout invalidates replayed cookies', { timeout: 45_000 }, async () => {
  const { mf, db, credential } = await createHarness(undefined, false, { NODE_ENV: 'production' });
  try {
    const login = await mf.dispatchFetch('https://localhost/auth/google', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const body = JSON.stringify({ name: 'CSRF fixture', purpose: '비상금', currency: 'KRW' });
    for (const unsafe of ['https://attacker-owned.pages.dev', 'https://untrusted.example', 'null', 'http://localhost:5173', undefined]) {
      const response = await mf.dispatchFetch('https://localhost/granaries', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(unsafe ? { Origin: unsafe } : {}) }, body });
      assert.equal(response.status, 403);
    }
    assert.equal((await mf.dispatchFetch('https://localhost/granaries', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'text/plain' }, body })).status, 415);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM gk_granaries').first<{ count: number }>())?.count, 0);
    for (const unsafe of ['https://attacker-owned.pages.dev', 'https://localhost.evil.example', 'capacitor://evil', 'http://localhost:5173']) {
      assert.equal((await mf.dispatchFetch('https://localhost/granaries', { headers: { Origin: unsafe, Cookie: cookie } })).headers.get('access-control-allow-origin'), null);
      assert.equal((await mf.dispatchFetch('https://localhost/granaries', { method: 'OPTIONS', headers: { Origin: unsafe, 'Access-Control-Request-Method': 'POST' } })).status, 403);
    }
    for (const trusted of [origin, 'capacitor://localhost', 'https://localhost']) {
      const response = await mf.dispatchFetch('https://localhost/granaries', { method: 'POST', headers: { Cookie: cookie, Origin: trusted, 'Content-Type': 'application/json; charset=utf-8' }, body });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('access-control-allow-origin'), trusted);
    }
    const noLogout = await mf.dispatchFetch('https://localhost/auth/logout', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://evil.example' } });
    assert.equal(noLogout.status, 403);
    const logout = await mf.dispatchFetch('https://localhost/auth/logout', { method: 'POST', headers: { Cookie: cookie, Origin: origin } });
    assert.equal(logout.status, 200);
    assert.equal((await mf.dispatchFetch('https://localhost/granaries', { headers: { Cookie: cookie } })).status, 401);
    assert.equal((await mf.dispatchFetch('https://localhost/auth/me', { headers: { Cookie: cookie } })).headers.get('cache-control'), 'no-store');
    assert.ok((await db.prepare('SELECT COUNT(*) AS count FROM gk_security_audit_log WHERE status = 403').first<{ count: number }>())!.count >= 5);
  } finally { await mf.dispose(); }
});

void test('automation keys enforce scope, expiry and caller identity without breaking public diary readers', { timeout: 45_000 }, async () => {
  const secret = 'fixture-weekly-key-that-is-at-least-32-bytes';
  const expired = 'fixture-expired-key-that-is-at-least-32-bytes';
  const { mf, db } = await createHarness(undefined, false, { AUTOMATION_API_KEYS: JSON.stringify([
    { id: 'weekly', secret, scopes: ['settings:read', 'discord:notify'] },
    { id: 'expired', secret: expired, scopes: ['settings:read'], expiresAt: '2020-01-01T00:00:00Z' },
  ]) });
  try {
    const call = (path: string, method = 'GET', key = secret) => mf.dispatchFetch('http://localhost'+path, { method, headers: { 'X-API-Secret': key, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: '{}' }) });
    assert.equal((await call('/settings')).status, 200);
    assert.equal((await call('/settings', 'GET', expired)).status, 401);
    assert.equal((await call('/settings', 'GET', 'invalid')).status, 401);
    assert.equal((await call('/granaries')).status, 403);
    assert.equal((await call('/positions', 'POST')).status, 403);
    assert.equal((await call('/judgment-diary')).status, 200);
    assert.equal((await call('/automation/discord-notify', 'POST')).status, 503);
    assert.equal((await call('/settings/weekly_report_rsi_overbought', 'PATCH', 'fixture-only-api-secret')).status, 403);
    assert.equal((await call('/granaries/export', 'GET', 'fixture-only-api-secret')).status, 403);
    assert.equal((await call('/granaries', 'GET', 'fixture-only-api-secret')).status, 200);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM gk_security_audit_log WHERE actor = 'automation:weekly'").first<{ count: number }>())?.count, 2);
  } finally { await mf.dispose(); }
});

void test('login rate limit is shared and atomic; oversized streamed bodies are rejected before parsing', { timeout: 45_000 }, async () => {
  const { mf, db } = await createHarness();
  try {
    const responses = await Promise.all(Array.from({ length: 24 }, () => mf.dispatchFetch('http://localhost/auth/google', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10' }, body: '{"credential":"invalid"}' })));
    assert.equal(responses.filter((response) => response.status === 401).length, 20);
    assert.equal(responses.filter((response) => response.status === 429).length, 4);
    assert.ok(responses.find((response) => response.status === 429)?.headers.get('retry-after'));
    const rateKey = await db.prepare('SELECT key FROM gk_security_rate_limits').first<{ key: string }>();
    assert.ok(rateKey && !rateKey.key.includes('192.0.2.10'));
    const large = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); controller.close(); } });
    const response = await mf.dispatchFetch('http://localhost/auth/google', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: large, duplex: 'half' });
    assert.equal(response.status, 413);
  } finally { await mf.dispose(); }
});

void test('signed Pages client IPs get independent rate buckets; unsigned forwarded IPs cannot bypass limits', { timeout: 45_000 }, async () => {
  const secret = 'fixture-proxy-secret-at-least-32-bytes';
  const { mf } = await createHarness(undefined, false, { PROXY_AUTH_SECRET: secret });
  try {
    const call = async (ip: string, signed: boolean) => {
      const request = new Request('http://localhost/auth/google', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '2a06:98c0:3600::103', 'X-GK-Client-IP': ip }, body: '{"credential":"invalid"}' });
      if (signed) await attestProxyClient(request, ip, secret);
      return mf.dispatchFetch(request.url, { method: request.method, headers: Object.fromEntries(request.headers), body: await request.text() });
    };
    for (let i = 0; i < 20; i++) assert.equal((await call('192.0.2.1', true)).status, 401);
    assert.equal((await call('192.0.2.1', true)).status, 429);
    assert.equal((await call('192.0.2.2', true)).status, 401);
    for (let i = 0; i < 20; i++) assert.equal((await call('192.0.2.'+i, false)).status, 401);
    assert.equal((await call('192.0.2.99', false)).status, 429);
  } finally { await mf.dispose(); }
});
