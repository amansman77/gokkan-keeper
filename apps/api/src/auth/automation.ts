import type { Env } from '../types';

const SCOPES = ['portfolio:read', 'positions:sync', 'snapshots:sync', 'diary:publish', 'indicators:read', 'settings:read', 'discord:notify', 'alerts:run'] as const;
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

export function permitsAutomation(caller: Pick<Caller, 'scopes'>, pathname: string, method: string): boolean {
  const path = pathname.replace(/^\/api\/positions(?=\/|$)/, '/positions');
  const has = (scope: Scope) => caller.scopes.includes(scope);
  if (method === 'GET') {
    if (/^\/positions\/indicators(?:\/series)?$/.test(path)) return has('indicators:read');
    if (path === '/settings') return has('settings:read');
    if (/^\/(granaries|positions|snapshots)(?:\/[0-9a-f-]{36})?$/.test(path)) return has('portfolio:read');
    return false;
  }
  if (path === '/automation/discord-notify' && method === 'POST') return has('discord:notify');
  if (/^\/alerts\/run\/(daily|weekly)$/.test(path) && method === 'POST') return has('alerts:run');
  if (path === '/judgment-diary' && method === 'POST') return has('diary:publish');
  if ((path === '/positions' && method === 'POST') || (/^\/positions\/[0-9a-f-]{36}$/.test(path) && ['PATCH', 'DELETE'].includes(method))) return has('positions:sync');
  return ((path === '/snapshots' && method === 'POST') || (/^\/snapshots\/[0-9a-f-]{36}$/.test(path) && method === 'PUT')) && has('snapshots:sync');
}
