import { build } from 'esbuild';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const owner = { aud: 'fixture.apps.googleusercontent.com', email: 'fixture@example.com', email_verified: 'true', sub: 'fixture-owner' };
export async function createHarness(port?: number, alerts = false) {
  const apiRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await build({ absWorkingDir: apiRoot, entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  const outbound: string[] = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: result.outputFiles[0].text,
    compatibilityDate: '2024-01-15', host: '127.0.0.1', port: port ?? 0,
    log: new Log(LogLevel.ERROR), d1Databases: ['DB'], d1Persist: false,
    bindings: { GOOGLE_CLIENT_ID: owner.aud, ALLOWED_EMAIL: owner.email, ALLOWED_SUB: owner.sub,
      SESSION_SECRET: 'fixture-only-long-session-secret', API_SECRET: 'fixture-only-api-secret', ...(alerts ? { DISCORD_WEBHOOK_URL: 'https://discord.fixture/alerts' } : {}) },
    outboundService: (request) => {
      outbound.push(request.url);
      const url = new URL(request.url);
      if (url.origin === 'https://oauth2.googleapis.com' && url.pathname === '/tokeninfo') {
        return url.searchParams.get('id_token') === 'fixture-owner-token'
          ? Response.json(owner) : new Response('invalid fixture token', { status: 401 });
      }
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
    return { mf, db, outbound };
  } catch (error) { await mf.dispose(); throw error; }
}
