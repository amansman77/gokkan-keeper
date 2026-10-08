import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHarness } from './harness';

void test('real Worker cookie authentication and the strict curl auth smoke check', { timeout: 45_000 }, async () => {
  const { mf, outbound } = await createHarness();
  try {
    const response = await mf.dispatchFetch('http://localhost/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'fixture-owner-token', next: '/granaries/new' }) });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!;
    assert.ok(cookie.includes('HttpOnly'));
    const authenticated = await mf.dispatchFetch('http://localhost/granaries', { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(authenticated.status, 200);
    for (const mode of ['daily', 'weekly']) {
      for (const headers of [{ Cookie: cookie.split(';')[0] }, { 'X-API-Secret': 'incorrect-fixture-secret' }]) {
        assert.equal((await mf.dispatchFetch(`http://localhost/alerts/run/${mode}`, { method: 'POST', headers })).status, 401);
      }
    }
    const { stdout } = await promisify(execFile)('bash', [fileURLToPath(new URL('../auth-integration-test.sh', import.meta.url))], {
      env: { ...process.env, BASE_URL: String(await mf.ready) }, timeout: 25_000,
    });
    assert.ok(stdout.includes('All auth integration checks passed.'));
    assert.equal(outbound.length, 2);
    assert.ok(outbound.every((url) => url.startsWith('https://oauth2.googleapis.com/tokeninfo?')));
  } finally { await mf.dispose(); }
});
