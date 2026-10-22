import type { Env } from '../types';

export async function verifyConsultingChallenge(env: Env, token: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY || !token || token.length > 2048) return false;
  // remoteip is optional; omit it to avoid cross-zone Worker IP attribution
  // and sharing additional client metadata with the verification service.
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    return result.success === true && result.action === 'consulting'
      && (result.hostname === 'gokkan-keeper.yetimates.com' || (env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(result.hostname || '')));
  } catch { return false; }
}
