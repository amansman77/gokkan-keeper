import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import { createSessionToken, readSessionFromCookie } from '../../src/auth/session';
import type { Env } from '../../src/types';

const env = { GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', ALLOWED_EMAIL: 'fixture@example.com',
  ALLOWED_SUB: 'fixture-owner', SESSION_SECRET: 'fixture-only-long-secret' } as Env;
const claims = { aud: env.GOOGLE_CLIENT_ID, email: env.ALLOWED_EMAIL, sub: env.ALLOWED_SUB, email_verified: 'true' };
const app = createApp();
void test('Google login establishes a private cookie; me and logout use that cookie', async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(claims);
  try {
    const response = await app.request('https://api.example/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'fixture-token', next: '//untrusted.example' }) }, env);
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { next: string }).next, '/dashboard');
    const cookie = response.headers.get('set-cookie')!;
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=None', 'Path=/']) assert.ok(cookie.includes(flag));
    const me = await app.request('https://api.example/auth/me', { headers: { Cookie: cookie.split(';')[0] } }, env);
    assert.equal((await me.json() as { authenticated: boolean }).authenticated, true);
    const logout = await app.request('https://api.example/auth/logout', { method: 'POST' }, env);
    assert.ok(logout.headers.get('set-cookie')?.includes('Max-Age=0'));
    const local = await app.request('http://localhost/auth/google', { method: 'POST', body: JSON.stringify({ credential: 'fixture-token' }) }, env);
    assert.ok(local.headers.get('set-cookie')?.includes('SameSite=Lax'));
    assert.ok(!local.headers.get('set-cookie')?.includes('Secure'));
  } finally { globalThis.fetch = fetch; }
});
void test('wrong audience, unverified email, non-owner, missing/mismatched subject and provider failure are rejected', async () => {
  const fetch = globalThis.fetch;
  try {
    for (const invalid of [{ ...claims, aud: 'wrong' }, { ...claims, email_verified: 'false' }, { ...claims, email: 'other@example.com' }, { ...claims, sub: 'other' }, { ...claims, sub: undefined }]) {
      globalThis.fetch = async () => Response.json(invalid);
      const response = await app.request('/auth/google', { method: 'POST', body: JSON.stringify({ credential: 'fixture-token' }) }, env);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);
    }
    globalThis.fetch = async () => new Response('invalid', { status: 401 });
    assert.equal((await app.request('/auth/google', { method: 'POST', body: '{"credential":"invalid"}' }, env)).status, 401);
    globalThis.fetch = async () => { throw new Error('fixture provider unavailable'); };
    assert.equal((await app.request('/auth/google', { method: 'POST', body: '{"credential":"fixture"}' }, env)).status, 401);
    assert.equal((await app.request('/auth/google', { method: 'POST', body: '{}' }, env)).status, 400);
    assert.equal((await app.request('/auth/google', { method: 'POST', body: '{"credential":"fixture"}' }, { ...env, SESSION_SECRET: '' })).status, 500);
  } finally { globalThis.fetch = fetch; }
});
void test('sessions reject tampering, incorrect keys, extra segments, malformed cookies and expiration', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 9) });
  const token = await createSessionToken(env.SESSION_SECRET, { sub: 'owner', email: env.ALLOWED_EMAIL });
  const request = (value: string) => new Request('https://api.example', { headers: { Cookie: `gk_session=${value}` } });
  assert.ok(await readSessionFromCookie(request(token), env.SESSION_SECRET));
  for (const invalid of [token.replace(/^./, token[0] === 'e' ? 'f' : 'e'), token+'.extra', '%E0%A4%A', 'missing-signature', 'a.b']) {
    assert.equal(await readSessionFromCookie(request(invalid), env.SESSION_SECRET), null);
  }
  assert.equal(await readSessionFromCookie(request(token), 'incorrect-secret'), null);
  assert.equal(await readSessionFromCookie(new Request('https://api.example'), env.SESSION_SECRET), null);
  t.mock.timers.setTime(Date.UTC(2026, 10, 9));
  assert.equal(await readSessionFromCookie(request(token), env.SESSION_SECRET), null);
});
