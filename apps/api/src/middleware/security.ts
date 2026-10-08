import { readProxyClient } from '@gokkan-keeper/shared';
import { createMiddleware } from 'hono/factory';
import { bodyLimit } from 'hono/body-limit';
import type { Env, Variables } from '../types';
import { SecurityRepository } from '../db/repositories/security-repository';
import { isSafeMethod, isTrustedOrigin } from '../http/origins';

type AppEnv = { Bindings: Env; Variables: Variables };
export const requestSecurity = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  c.header('X-Frame-Options', 'DENY');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Cache-Control', 'no-store');
  if (c.req.url.startsWith('https://')) c.header('Strict-Transport-Security', 'max-age=31536000');
  const domain = c.req.path.replace(/^\/api\//, '/').split('/')[1] || 'root';
  await next();
  if (!isSafeMethod(c.req.method)) {
    const actor = c.get('actor') || 'anonymous';
    // Only fixed route domains are recorded, never bodies, query strings, cookies,
    // IPs, email addresses or attacker-controlled paths.
    const knownDomain = ['auth', 'public', 'granaries', 'snapshots', 'positions', 'judgment-diary', 'alerts', 'alert-thresholds', 'settings', 'automation', 'cash-flows'].includes(domain) ? domain : 'unknown';
    console.info(JSON.stringify({ event: 'security_request', requestId, actor, domain: knownDomain, method: c.req.method, status: c.res.status }));
    // Avoid turning unauthenticated probing into unbounded database writes.
    if (actor === 'anonymous' && !(c.req.path === '/auth/google' && ![403, 429].includes(c.res.status)) && !(domain === 'public' && c.res.status === 201)) return;
    try { await new SecurityRepository(c.env.DB).recordEvent(requestId, actor, knownDomain, c.req.method, c.res.status); }
    catch { console.error(JSON.stringify({ event: 'audit_store_failed', requestId })); }
  }
});

export const browserRequestPolicy = createMiddleware<AppEnv>(async (c, next) => {
  const domain = c.req.path.split('/')[1];
  if (c.req.method === 'OPTIONS' && !isTrustedOrigin(c.req.header('Origin'), c.env)) return c.json({ error: 'Untrusted origin' }, 403);
  // Login/logout are outside owner middleware, but still need browser intent.
  if (!isSafeMethod(c.req.method) && domain === 'auth' && !isTrustedOrigin(c.req.header('Origin'), c.env)) {
    return c.json({ error: 'Untrusted origin' }, 403);
  }
  if (!isSafeMethod(c.req.method) && c.req.path !== '/auth/logout' && !c.req.path.includes('/alerts/run/') && c.req.method !== 'DELETE') {
    const mime = (c.req.header('Content-Type') || '').split(';')[0].trim().toLowerCase();
    const consulting = c.req.path === '/public/consulting-request' || c.req.path === '/api/public/consulting-request';
    if (mime !== (consulting ? 'multipart/form-data' : 'application/json')) return c.json({ error: 'Unsupported content type' }, 415);
  }
  await next();
});

export const requestBodyLimit = createMiddleware<AppEnv>(async (c, next) => {
  const consulting = ['/public/consulting-request', '/api/public/consulting-request'].includes(c.req.path);
  return bodyLimit({ maxSize: (consulting ? 11 : 1) * 1024 * 1024, onError: (ctx) => ctx.json({ error: 'Request body too large' }, 413) })(c, next);
});

export const abuseProtection = createMiddleware<AppEnv>(async (c, next) => {
  const consulting = ['/public/consulting-request', '/api/public/consulting-request'].includes(c.req.path);
  if (c.req.method !== 'POST' || (!consulting && c.req.path !== '/auth/google')) return next();
  if (!c.env.SESSION_SECRET) return c.json({ error: 'Security configuration unavailable' }, 500);
  const ip = await readProxyClient(c.req.raw, c.env.PROXY_AUTH_SECRET) || c.req.header('CF-Connecting-IP') || 'unknown';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(c.env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  const bucket = `${consulting ? 'consulting' : 'login'}:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  const seconds = consulting ? 3600 : 600;
  if (!await new SecurityRepository(c.env.DB).consumeRateLimit(bucket, Math.floor(Date.now() / 1000), seconds, consulting ? 3 : 20)) {
    c.header('Retry-After', String(seconds - Math.floor(Date.now() / 1000) % seconds));
    return c.json({ error: 'Too many requests' }, 429);
  }
  return next();
});
