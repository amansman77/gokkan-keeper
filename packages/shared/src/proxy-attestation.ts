// Server-to-server attestation for Pages -> API client attribution. These headers
// never authenticate an owner or automation caller. Do not expose the secret to Vite.
const IP_HEADER = 'X-GK-Client-IP';
const TIME_HEADER = 'X-GK-Proxy-Time';
const SIGNATURE_HEADER = 'X-GK-Proxy-Signature';
const encoder = new TextEncoder();

function message(request: Request, ip: string, time: string) {
  const url = new URL(request.url);
  return JSON.stringify([request.method, url.pathname, url.search, ip, time]);
}
async function key(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function attestProxyClient(request: Request, ip: string | null, secret?: string) {
  // Always strip supplied attestations; only the Cloudflare edge IP is forwarded.
  for (const header of [IP_HEADER, TIME_HEADER, SIGNATURE_HEADER]) request.headers.delete(header);
  if (!ip || ip.length > 64 || !secret || secret.length < 32) return;
  const time = String(Math.floor(Date.now() / 1000));
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(message(request, ip, time)));
  request.headers.set(IP_HEADER, ip);
  request.headers.set(TIME_HEADER, time);
  request.headers.set(SIGNATURE_HEADER, Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(''));
}
export async function readProxyClient(request: Request, secret?: string): Promise<string | null> {
  if (!secret || secret.length < 32) return null;
  const ip = request.headers.get(IP_HEADER), time = request.headers.get(TIME_HEADER), signature = request.headers.get(SIGNATURE_HEADER);
  if (!ip || ip.length > 64 || !time || !/^\d{10}$/.test(time) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return null;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(time)) > 30) return null;
  const bytes = Uint8Array.from(signature.match(/../g)!, (byte) => Number.parseInt(byte, 16));
  return await crypto.subtle.verify('HMAC', await key(secret), bytes, encoder.encode(message(request, ip, time))) ? ip : null;
}
