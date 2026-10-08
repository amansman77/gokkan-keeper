import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function smokeProduction(target, fetcher = fetch, expectedAssets = [], retries = 3) {
  if (!['api', 'web', 'all'].includes(target)) throw new Error('Expected api, web, or all');
  const results = [];
  async function check(url, expectedStatus = 200) {
    let response;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        response = await fetcher(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(10_000) });
        if (response.status === expectedStatus) { results.push({ url, status: response.status }); return response; }
      } catch { /* Retry transient network failures; never accept them as a pass. */ }
      if (attempt+1 < retries) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`${url}: expected ${expectedStatus}, received ${response?.status ?? 'network failure'}`);
  }
  const api = 'https://gokkan-keeper-api-production.amansman77.workers.dev';
  const web = 'https://gokkan-keeper.yetimates.com';
  if (target !== 'web') {
    const health = await (await check(api+'/health')).json();
    if (health.status !== 'ok') throw new Error('API health response is invalid');
    await check(api+'/granaries', 401);
    const portfolio = await (await check(api+'/public/portfolio')).json();
    if (!Array.isArray(portfolio.data)) throw new Error('Public portfolio response is invalid');
  }
  if (target !== 'api') {
    const html = await (await check(web+'/?deployment-smoke='+Date.now())).text();
    if (!html.includes('<html')) throw new Error('Web response is not HTML');
    for (const asset of expectedAssets) {
      if (!asset.startsWith('/assets/') || !html.includes(asset)) throw new Error('Production HTML does not match the freshly built assets');
      await check(web+asset);
    }
    await check(web+'/archive'); await check(web+'/login');
    await check(web+'/api/granaries', 401);
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
