import type { Env } from '../types';

const SCOPES = ['portfolio:read', 'positions:sync', 'snapshots:sync', 'diary:publish', 'indicators:read', 'settings:read', 'discord:notify', 'alerts:run', 'imports:process'] as const;
type Scope = typeof SCOPES[number];
interface Caller { id: string; secret: string; scopes: Scope[]; expiresAt?: string }

function callers(env: Env): Caller[] {
  const result: Caller[] = [];
  if (env.AUTOMATION_API_KEYS) {
    const value: unknown = JSON.parse(env.AUTOMATION_API_KEYS);
    if (!Array.isArray(value) || value.length > 20) throw new Error('Invalid automation configuration');
    for (const candidate of value as unknown[]) {
      if (!candidate || typeof candidate !== 'object') throw new Error('Invalid automation configuration');
      const entry = candidate as Record<string, unknown>;
      if (typeof entry.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(entry.id) || typeof entry.secret !== 'string' || entry.secret.length < 32
        || !Array.isArray(entry.scopes) || !entry.scopes.length || !entry.scopes.every((scope: unknown) => typeof scope === 'string' && (SCOPES as readonly string[]).includes(scope))
        || (entry.expiresAt !== undefined && (typeof entry.expiresAt !== 'string' || !Number.isFinite(Date.parse(entry.expiresAt))))) throw new Error('Invalid automation configuration');
      result.push(entry as unknown as Caller);
    }
    if (new Set(result.map((entry) => entry.id)).size !== result.length || new Set(result.map((entry) => entry.secret)).size !== result.length) throw new Error('Duplicate automation configuration');
  }
  // Compatibility for existing jobs. It no longer grants owner settings,
  // cash-flow, granary writes, exports, or diary rewriting privileges.
  if (env.API_SECRET) result.push({ id: 'legacy', secret: env.API_SECRET, scopes: [...SCOPES] });
  return result;
}

export async function authenticateAutomation(header: string, env: Env): Promise<Caller | null> {
  if (!header || header.length > 1024) return null;
  const presented = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(header)));
  for (const caller of callers(env)) {
    const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(caller.secret)));
    let mismatch = 0;
    for (let index = 0; index < expected.length; index++) mismatch |= expected[index] ^ presented[index];
    if (!mismatch && (!caller.expiresAt || Date.parse(caller.expiresAt) > Date.now())) return caller;
  }
  return null;
}

const UUID = '[0-9a-f-]{36}';
/**
 * Every request an automation key may make: method, exact path pattern, and
 * the scope that grants it. Anything not listed is refused.
 */
const AUTOMATION_ROUTES: ReadonlyArray<[methods: readonly string[], path: RegExp, scope: Scope]> = [
  // includes public index/FX quotes: toss-sync needs USD/KRW, the weekly report shows indices
  [['GET'], /^(?:\/positions\/indicators(?:\/series)?|\/market-indices)$/, 'indicators:read'],
  [['GET'], /^\/settings$/, 'settings:read'],
  [['GET'], new RegExp(`^/(granaries|positions|snapshots)(?:/${UUID})?$`), 'portfolio:read'],
  [['POST'], /^\/automation\/discord-notify$/, 'discord:notify'],
  [['POST'], /^\/alerts\/run\/(daily|weekly)$/, 'alerts:run'],
  [['POST'], /^\/judgment-diary$/, 'diary:publish'],
  [['POST'], /^\/positions$/, 'positions:sync'],
  [['PATCH', 'DELETE'], new RegExp(`^/positions/${UUID}$`), 'positions:sync'],
  [['POST'], /^\/snapshots$/, 'snapshots:sync'],
  [['PUT'], new RegExp(`^/snapshots/${UUID}$`), 'snapshots:sync'],
  // the Mac OCR worker: lease a job, read its images, report the OCR result
  [['GET'], new RegExp(`^/imports/(?:next|${UUID}/images/\\d{1,2})$`), 'imports:process'],
  [['POST'], new RegExp(`^/imports/${UUID}/(?:ocr|fail)$`), 'imports:process'],
];

export function permitsAutomation(caller: Pick<Caller, 'scopes'>, pathname: string, method: string): boolean {
  const path = pathname.replace(/^\/api\/positions(?=\/|$)/, '/positions');
  return AUTOMATION_ROUTES.some(([methods, pattern, scope]) => methods.includes(method) && pattern.test(path) && caller.scopes.includes(scope));
}
