import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../types';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 5000, cacheMaxAge: 3600_000 });
export async function verifyGoogleCredential(credential: string, env: Env) {
  const { payload } = await jwtVerify(credential, googleKeys, {
    algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.GOOGLE_CLIENT_ID,
    requiredClaims: ['exp', 'iat', 'sub', 'email', 'email_verified'], maxTokenAge: '2h', clockTolerance: 30,
  });
  if (payload.email_verified !== true || payload.email !== env.ALLOWED_EMAIL || !payload.sub || (env.ALLOWED_SUB && payload.sub !== env.ALLOWED_SUB)) throw new Error('Unauthorized Google identity');
  return { sub: payload.sub, email: env.ALLOWED_EMAIL };
}
