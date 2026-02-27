import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_URL = (process.env.VITE_SITE_URL || 'https://gokkan-keeper.yetimates.com').replace(/\/+$/, '');
const API_BASE_URL = (process.env.VITE_API_BASE_URL || 'https://gokkan-keeper-api-production.amansman77.workers.dev').replace(/\/+$/, '');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const PRIVATE_DISALLOW_PATHS = [
  '/dashboard',
  '/dashboard/',
  '/granaries',
  '/granaries/',
  '/snapshots',
  '/snapshots/',
  '/positions',
  '/positions/',
  '/accounts',
  '/accounts/',
  '/login',
  '/judgment-diary/new',
  '/judgment-diary/*/edit',
];

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

async function fetchJudgmentEntries() {
  const url = `${API_BASE_URL}/judgment-diary?limit=500`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch judgment entries: ${response.status}`);
  }

  return response.json();
}

async function writeRobots() {
  const disallowLines = PRIVATE_DISALLOW_PATHS.map((pathname) => `Disallow: ${pathname}`).join('\n');
  const content = `User-agent: *\nAllow: /\n${disallowLines ? `\n${disallowLines}` : ''}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  await fs.writeFile(path.join(PUBLIC_DIR, 'robots.txt'), content, 'utf8');
}

async function writeSitemap() {
  const staticPaths = ['/', '/archive', '/judgment-diary', '/consulting'];
  const urls = new Set(staticPaths.map((value) => `${SITE_URL}${value}`));

  try {
    const entries = await fetchJudgmentEntries();
    for (const entry of entries) {
      if (!entry?.title) continue;
      const slug = slugify(entry.title);
      if (!slug) continue;
      urls.add(`${SITE_URL}/judgment-diary/${slug}`);
    }
  } catch (error) {
    console.warn('[generate-seo-files] Judgment entries fetch skipped:', error.message);
  }

  const sortedUrls = [...urls].sort((a, b) => a.localeCompare(b));
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sortedUrls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  await fs.writeFile(path.join(PUBLIC_DIR, 'sitemap.xml'), xml, 'utf8');
}

await writeRobots();
await writeSitemap();

console.log(`[generate-seo-files] Generated robots.txt and sitemap.xml for ${SITE_URL}`);
