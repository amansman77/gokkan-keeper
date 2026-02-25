import type { Context } from 'hono';
import type { Env } from '../types';

const SESSION_COOKIE_NAME = 'gk_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const base64 = normalized + '='.repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const index = entry.indexOf('=');
      if (index === -1) return acc;
      const key = entry.slice(0, index).trim();
      const value = entry.slice(index + 1).trim();
      if (!key) return acc;
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function createSessionToken(
  secret: string,
  payload: Pick<SessionPayload, 'sub' | 'email'>,
): Promise<string> {
  const iat = nowSeconds();
  const fullPayload: SessionPayload = {
    sub: payload.sub,
    email: payload.email,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };

  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function readSessionFromCookie(
  request: Request,
  secret: string,
): Promise<SessionPayload | null> {
  const cookies = parseCookies(request.headers.get('cookie') || undefined);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) return null;

  const expected = await sign(encodedPayload, secret);
  if (encodedSignature !== expected) return null;

  let payload: SessionPayload | null = null;
  try {
    const payloadJson = new TextDecoder().decode(fromBase64Url(encodedPayload));
    payload = safeJsonParse<SessionPayload>(payloadJson);
  } catch {
    return null;
  }

  if (!payload) return null;
  if (!payload.sub || !payload.email || !payload.exp || payload.exp <= nowSeconds()) {
    return null;
  }

  return payload;
}

function cookieBaseOptions(c: Context<{ Bindings: Env }>): string {
  const secure = c.req.url.startsWith('https://');
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function setSessionCookie(c: Context<{ Bindings: Env }>, token: string): void {
  const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; ${cookieBaseOptions(c)}`;
  c.header('Set-Cookie', cookie);
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>): void {
  const cookie = `${SESSION_COOKIE_NAME}=; Max-Age=0; ${cookieBaseOptions(c)}`;
  c.header('Set-Cookie', cookie);
}
