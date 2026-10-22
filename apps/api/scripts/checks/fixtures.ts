import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { D1Database } from '@cloudflare/workers-types';

export async function createIdentityFixture() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = crypto.randomUUID();
  const jwks = { keys: [{ ...await exportJWK(publicKey), kid, use: 'sig', alg: 'RS256' }] };
  const claims = { email: 'fixture@example.com', email_verified: true };
  const sign = (extra: Record<string, unknown> = {}) => new SignJWT({ ...claims,
    iss: 'https://accounts.google.com', aud: 'fixture.apps.googleusercontent.com', sub: 'fixture-owner',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...extra,
  }).setProtectedHeader({ alg: 'RS256', kid }).sign(privateKey);
  return { jwks, sign, credential: await sign() };
}

// Only security-query semantics for Node unit tests. Full migration and SQL
// correctness is verified separately by the real Worker/D1 integration suite.
export function memorySecurityDatabase(): D1Database {
  const sessions = new Map<string, number>();
  const limits = new Map<string, { start: number; count: number }>();
  return { prepare(sql: string) {
    let values: unknown[] = [];
    const statement = {
      bind(...args: unknown[]) { values = args; return statement; },
      async run() {
        if (sql.startsWith('INSERT INTO gk_sessions')) sessions.set(String(values[0]), Number(values[1]));
        if (sql.startsWith('DELETE FROM gk_sessions')) sessions.delete(String(values[0]));
        return { success: true };
      },
      async first() {
        if (sql.includes('gk_sessions')) return (sessions.get(String(values[0])) || 0) > Number(values[1]) ? { id: values[0] } : null;
        if (sql.includes('gk_security_rate_limits')) {
          const key = String(values[0]), start = Number(values[1]);
          const previous = limits.get(key);
          const count = previous?.start === start ? previous.count + 1 : 1;
          limits.set(key, { start, count });
          return { attempts: count };
        }
        return null;
      },
      async all() { return { results: [] }; },
    };
    return statement;
  } } as unknown as D1Database;
}
