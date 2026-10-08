import { build } from 'esbuild';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createIdentityFixture } from '../fixtures';

export const owner = { aud: 'fixture.apps.googleusercontent.com', email: 'fixture@example.com', email_verified: 'true', sub: 'fixture-owner' };
export async function createHarness(port?: number, alerts = false, extraBindings: Record<string, string> = {}) {
  const apiRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await build({ absWorkingDir: apiRoot, entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  const outbound: string[] = [];
  const identity = await createIdentityFixture();
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: result.outputFiles[0].text,
    compatibilityDate: '2024-01-15', host: '127.0.0.1', port: port ?? 0,
    log: new Log(LogLevel.ERROR), d1Databases: ['DB'], d1Persist: false,
    bindings: { GOOGLE_CLIENT_ID: owner.aud, ALLOWED_EMAIL: owner.email, ALLOWED_SUB: owner.sub,
      SESSION_SECRET: 'fixture-only-long-session-secret', API_SECRET: 'fixture-only-api-secret', TURNSTILE_SECRET_KEY: 'fixture-only-challenge-secret', ...(alerts ? { DISCORD_WEBHOOK_URL: 'https://discord.fixture/alerts' } : {}), ...extraBindings },
    outboundService: (request) => {
      outbound.push(request.url);
      const url = new URL(request.url);
      if (url.href === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json(identity.jwks);
      if (url.href === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return request.json().then((body: unknown) => Response.json({ success: !!body && typeof body === 'object' && 'response' in body && body.response === 'fixture-challenge-token', hostname: 'localhost', action: 'consulting' }));
      if (alerts && url.origin === 'https://discord.fixture' && url.pathname === '/alerts') return new Response(null, { status: 204 });
      throw new Error(`Unexpected external request in isolated tests: ${url.origin}${url.pathname}`);
    },
  }));
  try {
    const db = await mf.getD1Database('DB');
    const migrationsDir = new URL('../../../../../migrations/', import.meta.url);
    for (const name of (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(name, migrationsDir), 'utf8');
      for (const statement of splitSqlQuery(sql)) await db.prepare(statement).run();
    }
    return { mf, db, outbound, credential: identity.credential };
  } catch (error) { await mf.dispose(); throw error; }
}
