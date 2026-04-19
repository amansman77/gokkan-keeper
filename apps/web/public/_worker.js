const CANONICAL_ORIGIN = 'https://gokkan-keeper.yetimates.com';
const API_ORIGIN = 'https://gokkan-keeper-api-production.amansman77.workers.dev';
const SITEMAP_STATIC_PATHS = ['/', '/archive', '/judgment-diary', '/consulting'];

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value, fallback) {
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
      const entries = await response.json();
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (!entry || typeof entry.title !== 'string') continue;
          const slug = slugify(entry.title);
          if (!slug) continue;

          const loc = `${CANONICAL_ORIGIN}/judgment-diary/${slug}`;
          const lastmod = toIsoDate(entry.updatedAt || entry.createdAt, now);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname.endsWith('.pages.dev')) {
      return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const upstreamPath = url.pathname === '/api' ? '' : url.pathname.slice(4);
      const upstreamUrl = `${API_ORIGIN}${upstreamPath}${url.search}`;
      const proxyRequest = new Request(upstreamUrl, request);
      return fetch(proxyRequest);
    }

    if (url.pathname === '/sitemap.xml') {
      return createDynamicSitemap();
    }

    return env.ASSETS.fetch(request);
  },
};
