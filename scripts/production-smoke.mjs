import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function smokeProduction(target, fetcher = fetch, expectedAssets = [], retries = 3) {
  if (!['api', 'web', 'all'].includes(target)) throw new Error('Expected api, web, or all');
  const results = [];
  async function check(url, expectedStatus = 200, options = {}) {
    let response;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        response = await fetcher(url, { ...options, headers: { 'Cache-Control': 'no-cache', ...options.headers }, signal: AbortSignal.timeout(10_000) });
        if (response.status === expectedStatus) { results.push({ url, status: response.status }); return response; }
      } catch { /* Retry transient network failures; never accept them as a pass. */ }
      if (attempt+1 < retries) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`${url}: expected ${expectedStatus}, received ${response?.status ?? 'network failure'}`);
  }
  function securityHeaders(response, { privateData = false, webPage = false } = {}) {
    if (response.headers.get('x-content-type-options') !== 'nosniff'
      || response.headers.get('x-frame-options') !== 'DENY'
      || !response.headers.get('strict-transport-security')?.includes('max-age=31536000')
      || !response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'")) throw new Error('Required production security headers missing');
    if (privateData && response.headers.get('cache-control') !== 'no-store') throw new Error('Private response may be cached');
    if (webPage && !response.headers.get('content-security-policy')?.includes('https://challenges.cloudflare.com')) throw new Error('Web CSP is missing the challenge provider');
  }
  async function rejectedOrigin(base) {
    const response = await check(base+'/granaries', 403, { method: 'OPTIONS', headers: { Origin: 'https://untrusted-smoke.pages.dev', 'Access-Control-Request-Method': 'POST' } });
    if (response.headers.has('access-control-allow-origin')) throw new Error('Untrusted origin accepted by production CORS');
  }
  const api = 'https://gokkan-keeper-api-production.amansman77.workers.dev';
  const web = 'https://gokkan-keeper.yetimates.com';
  if (target !== 'web') {
    const health = await (await check(api+'/health')).json();
    if (health.status !== 'ok') throw new Error('API health response is invalid');
    securityHeaders(await check(api+'/granaries', 401), { privateData: true });
    await rejectedOrigin(api);
    const portfolio = await (await check(api+'/public/portfolio')).json();
    if (!Array.isArray(portfolio.data)) throw new Error('Public portfolio response is invalid');
  }
  if (target !== 'api') {
    const page = await check(web+'/?deployment-smoke='+Date.now());
    securityHeaders(page, { webPage: true });
    const html = await page.text();
    if (!html.includes('<html')) throw new Error('Web response is not HTML');
    for (const asset of expectedAssets) {
      if (!asset.startsWith('/assets/') || !html.includes(asset)) throw new Error('Production HTML does not match the freshly built assets');
      await check(web+asset);
    }
    await check(web+'/archive'); await check(web+'/login');
    securityHeaders(await check(web+'/api/granaries', 401), { privateData: true });
    await rejectedOrigin(web+'/api');
    const health = await (await check(web+'/api/health')).json();
    if (health.status !== 'ok') throw new Error('Pages API proxy health response is invalid');
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2] ?? 'all';
  const report = { target, checkedAt: new Date().toISOString(), passed: false };
  try {
    const assets = target === 'api' ? [] : [...(await readFile(new URL('../apps/web/dist/index.html', import.meta.url), 'utf8')).matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    if (target !== 'api' && !assets.length) throw new Error('No built web assets found');
    report.results = await smokeProduction(target, fetch, assets);
    report.passed = true;
    console.log('Production smoke passed:', report.results.length, 'read-only checks');
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    console.error(report.error); process.exitCode = 1;
  } finally {
    const directory = new URL('../test-results/', import.meta.url);
    await mkdir(directory, { recursive: true });
    await writeFile(new URL('production-smoke.json', directory), JSON.stringify(report, null, 2)+'\n');
  }
}
