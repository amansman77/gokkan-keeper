import { attestProxyClient, readProxyClient } from '@gokkan-keeper/shared';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import { isTrustedOrigin } from '../../src/http/origins';
import { authenticateAutomation, permitsAutomation } from '../../src/auth/automation';
import { isValidImage } from '../../src/services/image-validation';
import { handleConsultingRequest } from '../../src/services/consulting-request';
import { verifyConsultingChallenge } from '../../src/services/turnstile';
import { createSessionToken, registerSession, readActiveSession } from '../../src/auth/session';
import { memorySecurityDatabase } from './fixtures';
import type { Env } from '../../src/types';

const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
const env = { DB: memorySecurityDatabase(), GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', ALLOWED_EMAIL: 'fixture@example.com', SESSION_SECRET: 'fixture-session-secret', TURNSTILE_SECRET_KEY: 'fixture-challenge-secret', DISCORD_WEBHOOK_URL: 'https://discord.fixture/alerts' } as Env;

void test('origin allowlist rejects platform-wide, opaque and malformed origins', () => {
  for (const origin of [undefined, 'null', 'https://evil.pages.dev', 'https://localhost.evil', 'http://localhost:12/extra', 'capacitor://evil']) assert.equal(isTrustedOrigin(origin, env), false);
  assert.equal(isTrustedOrigin('http://localhost:5173', env), true);
  assert.equal(isTrustedOrigin('http://localhost:5173', { NODE_ENV: 'production' }), false);
});
void test('scoped key validation fails closed and domain permissions stay bounded', async () => {
  const key = 'fixture-scoped-key-with-at-least-32-characters';
  const configured = { ...env, AUTOMATION_API_KEYS: JSON.stringify([{ id: 'sync', secret: key, scopes: ['positions:sync', 'snapshots:sync'] }]) };
  const caller = await authenticateAutomation(key, configured);
  assert.ok(caller);
  assert.equal(permitsAutomation(caller, '/api/positions', 'POST'), true);
  assert.equal(permitsAutomation(caller, '/positions/00000000-0000-4000-8000-000000000000', 'PATCH'), true);
  assert.equal(permitsAutomation(caller, '/snapshots', 'POST'), true);
  assert.equal(permitsAutomation(caller, '/cash-flows', 'POST'), false);
  assert.equal(permitsAutomation(caller, '/settings', 'GET'), false);
  assert.equal(permitsAutomation(caller, '/judgment-diary/id', 'PUT'), false);
  assert.equal(await authenticateAutomation('wrong', configured), null);
  assert.equal(await authenticateAutomation('x'.repeat(1025), configured), null);
  for (const value of ['null', '[{}]', JSON.stringify([{ id: 'sync', secret: key, scopes: ['owner:all'] }]), JSON.stringify([{ id: 'sync', secret: key, scopes: ['positions:sync'], expiresAt: 'invalid' }])]) await assert.rejects(authenticateAutomation(key, { ...env, AUTOMATION_API_KEYS: value }));
});
void test('session owner allowlist changes invalidate an otherwise registered session', async () => {
  const token = await createSessionToken(env.SESSION_SECRET, { sub: 'fixture-owner', email: env.ALLOWED_EMAIL });
  await registerSession(env, token);
  const request = new Request('https://local', { headers: { Cookie: `gk_session=${token}` } });
  assert.ok(await readActiveSession(request, env));
  assert.equal(await readActiveSession(request, { ...env, ALLOWED_EMAIL: 'other@example.com' }), null);
  assert.equal(await readActiveSession(request, { ...env, ALLOWED_SUB: 'other' }), null);
});
void test('image signatures, container integrity, MIME mismatches and dimensions are validated', () => {
  assert.equal(isValidImage(validPng, 'image/png'), true);
  assert.equal(isValidImage(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z', 'base64'), 'image/jpeg'), true);
  assert.equal(isValidImage(Buffer.from('UklGRgYCAABXRUJQVlA4WAoAAAAgAAAAAAAAAAAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggGAAAADABAJ0BKgEAAQABQCYlpAADcAD+/TZoAA==', 'base64'), 'image/webp'), true);
  const broken = Buffer.from(validPng); broken[45] ^= 1;
  assert.equal(isValidImage(broken, 'image/png'), false);
  for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'text/html']) {
    assert.equal(isValidImage(new Uint8Array(), mime), false);
    assert.equal(isValidImage(Buffer.from('pretend-image'), mime), false);
  }
  assert.equal(isValidImage(validPng, 'image/jpeg'), false);
});
void test('consulting requires consent, a verified bot challenge and a real image; forwarded messages suppress mentions and original filenames', async () => {
  const original = globalThis.fetch;
  let delivered = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/siteverify')) {
      const body = JSON.parse(String(options?.body)) as { response: string };
      return Response.json({ success: body.response === 'fixture-token', action: 'consulting', hostname: 'gokkan-keeper.yetimates.com' });
    }
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    assert.ok(options?.body instanceof FormData);
    const payload = JSON.parse(String(options.body.get('payload_json'))) as { allowed_mentions: { parse: string[] }; content: string };
    assert.deepEqual(payload.allowed_mentions.parse, []);
    assert.ok(payload.content.length <= 1900);
    assert.ok(!(options.body.get('files[0]') as File).name.includes('private-name'));
    delivered++;
    return new Response(null, { status: 204 });
  };
  const form = () => {
    const data = new FormData(); data.set('email', 'fixture@example.com'); data.set('concern', '@everyone fixture');
    data.set('screenshot', new File([validPng], 'private-name.png', { type: 'image/png' })); data.set('consent', 'true'); data.set('cf-turnstile-response', 'fixture-token');
    return data;
  };
  try {
    assert.equal((await handleConsultingRequest(env, form())).ok, true);
    const noConsent = form(); noConsent.delete('consent'); await assert.rejects(handleConsultingRequest(env, noConsent));
    const noBot = form(); noBot.delete('cf-turnstile-response'); await assert.rejects(handleConsultingRequest(env, noBot));
    const fakeImage = form(); fakeImage.set('screenshot', new File(['not an image'], 'fake.png', { type: 'image/png' })); await assert.rejects(handleConsultingRequest(env, fakeImage));
    await assert.rejects(handleConsultingRequest({ ...env, TURNSTILE_SECRET_KEY: undefined }, form()));
    assert.equal(delivered, 1);
    for (const invalid of [{ success: false }, { success: true, hostname: 'evil.example', action: 'consulting' }, { success: true, hostname: 'localhost', action: 'other' }]) {
      globalThis.fetch = async () => Response.json(invalid);
      assert.equal(await verifyConsultingChallenge(env, 'token'), false);
    }
    globalThis.fetch = async () => { throw new Error('fixture network unavailable'); };
    assert.equal(await verifyConsultingChallenge(env, 'token'), false);
  } finally { globalThis.fetch = original; }
});
void test('unexpected errors expose only a generic message and request identifier', async () => {
  const broken = { ...env, DB: { prepare() { throw new Error('private-fixture-secret must never leave server'); } } } as unknown as Env;
  const response = await createApp().request('/public/portfolio', {}, broken);
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.ok(!body.includes('private-fixture-secret'));
  assert.ok(body.includes(response.headers.get('x-request-id')!));
});

void test('proxy IP attestation strips client input and rejects tampering, stale timestamps and wrong secrets', async () => {
  const secret = 'fixture-proxy-secret-at-least-32-bytes';
  const request = new Request('https://upstream/auth/google', { method: 'POST', headers: { 'X-GK-Client-IP': 'forged', 'X-GK-Proxy-Signature': 'forged' } });
  await attestProxyClient(request, '192.0.2.1', secret);
  assert.equal(await readProxyClient(request, secret), '192.0.2.1');
  assert.equal(await readProxyClient(request, 'other-fixture-secret-at-least-32-bytes'), null);
  assert.equal(await readProxyClient(new Request('https://upstream/auth/google', { method: 'DELETE', headers: request.headers }), secret), null);
  assert.equal(await readProxyClient(new Request('https://upstream/public/consulting-request', { method: 'POST', headers: request.headers }), secret), null);
  const tampered = new Request(request); tampered.headers.set('X-GK-Client-IP', '192.0.2.2');
  assert.equal(await readProxyClient(tampered, secret), null);
  const stale = new Request(request); stale.headers.set('X-GK-Proxy-Time', '1000000000');
  assert.equal(await readProxyClient(stale, secret), null);
  await attestProxyClient(request, null, secret);
  assert.equal(request.headers.get('X-GK-Client-IP'), null);
  assert.equal(await readProxyClient(request, secret), null);
});
