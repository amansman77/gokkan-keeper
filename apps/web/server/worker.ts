import { attestProxyClient } from '@gokkan-keeper/shared';

const CANONICAL_ORIGIN = 'https://gokkan-keeper.yetimates.com';
const API_ORIGIN = 'https://gokkan-keeper-api-production.amansman77.workers.dev';
const SITEMAP_STATIC_PATHS = ['/', '/archive', '/judgment-diary', '/consulting'];

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value: string | null | undefined, fallback: Date) {
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) return fallback.toISOString();
  return date.toISOString();
}

async function createDynamicSitemap() {
  const now = new Date();
  const urlMap = new Map(
    SITEMAP_STATIC_PATHS.map((pathname) => [`${CANONICAL_ORIGIN}${pathname}`, now.toISOString()])
  );

  try {
    const response = await fetch(`${API_ORIGIN}/judgment-diary?limit=500`, {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const entries: unknown = await response.json();
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object' || !('title' in entry) || typeof entry.title !== 'string') continue;
          const slug = slugify(entry.title);
          if (!slug) continue;

          const loc = `${CANONICAL_ORIGIN}/judgment-diary/${slug}`;
          const updatedAt = 'updatedAt' in entry && typeof entry.updatedAt === 'string' ? entry.updatedAt : null;
          const createdAt = 'createdAt' in entry && typeof entry.createdAt === 'string' ? entry.createdAt : null;
          const lastmod = toIsoDate(updatedAt || createdAt, now);
          urlMap.set(loc, lastmod);
        }
      }
    } else {
      console.warn(`[sitemap] Failed to fetch entries: ${response.status}`);
    }
  } catch (error) {
    console.warn('[sitemap] Failed to fetch entries', error);
  }

  const urls = [...urlMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(([loc, lastmod]) => `  <url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(lastmod)}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

interface PagesEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  API?: { fetch(request: Request): Promise<Response> };
  PROXY_AUTH_SECRET?: string;
}

const worker = {
  async fetch(request: Request, env: PagesEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname.endsWith('.pages.dev')) {
      return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const upstreamPath = url.pathname === '/api' ? '' : url.pathname.slice(4);
      const upstreamUrl = `${API_ORIGIN}${upstreamPath}${url.search}`;
      const proxyRequest = new Request(upstreamUrl, request);
      await attestProxyClient(proxyRequest, request.headers.get('CF-Connecting-IP'), env.PROXY_AUTH_SECRET);
      return env.API ? env.API.fetch(proxyRequest) : fetch(proxyRequest);
    }

    if (url.pathname === '/sitemap.xml') {
      return createDynamicSitemap();
    }

    return env.ASSETS.fetch(request);
  },
};

export const WEB_CONTENT_SECURITY_POLICY = [
  "default-src 'self'", "script-src 'self' https://accounts.google.com https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com", "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:", "connect-src 'self' https://accounts.google.com https://challenges.cloudflare.com https://cloudflareinsights.com https://gokkan-keeper-api-production.amansman77.workers.dev https://localhost",
  "frame-src https://accounts.google.com https://challenges.cloudflare.com",
  "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests',
].join('; ');

export default {
  async fetch(request: Request, env: PagesEnv): Promise<Response> {
    const response = await worker.fetch(request, env);
    const secured = new Response(response.body, response);
    secured.headers.set('Content-Security-Policy', WEB_CONTENT_SECURITY_POLICY);
    secured.headers.set('X-Frame-Options', 'DENY');
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (new URL(request.url).protocol === 'https:') secured.headers.set('Strict-Transport-Security', 'max-age=31536000');
    if (new URL(request.url).pathname.startsWith('/api')) secured.headers.set('Cache-Control', 'no-store');
    return secured;
  },
};
