import { createHarness } from './harness';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pagesWorker from '../../../../web/server/worker';
const proxySecret = 'fixture-only-proxy-secret-at-least-32-bytes';
const { mf, credential } = await createHarness(18787, true, { PROXY_AUTH_SECRET: proxySecret });
// Loopback-only fixture token bridge. Never bundled in the production Worker.
const fixtureServer = createServer((request, response) => {
  if (request.url !== '/credential') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ credential }));
}).listen(18788, '127.0.0.1');
const certificates = mkdtempSync(path.join(tmpdir(), 'gokkan-browser-tls-'));
const keyFile = path.join(certificates, 'key.pem'), certFile = path.join(certificates, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', keyFile, '-out', certFile], { stdio: 'ignore' });
const assetRoot = fileURLToPath(new URL('../../../../../test-results/web-browser-fixture/', import.meta.url));
const mime: Record<string, string> = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const productionFixture = createHttpsServer({ key: readFileSync(keyFile), cert: readFileSync(certFile) }, (request, response) => {
  void (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const incoming = new Request('https://localhost:18887'+request.url, { method: request.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
    incoming.headers.set('CF-Connecting-IP', '192.0.2.123');
    const result = await pagesWorker.fetch(incoming, {
      PROXY_AUTH_SECRET: proxySecret,
      API: { async fetch(upstream) { const result = await mf.dispatchFetch(upstream.url, { method: upstream.method, headers: Object.fromEntries(upstream.headers), ...(!['GET', 'HEAD'].includes(upstream.method) ? { body: await upstream.arrayBuffer() } : {}) }); return new Response(await result.arrayBuffer(), { status: result.status, headers: Object.fromEntries(result.headers) }); } },
      ASSETS: { async fetch(assetRequest) {
        const pathname = decodeURIComponent(new URL(assetRequest.url).pathname);
        let filename = path.resolve(assetRoot, '.'+pathname);
        if (!filename.startsWith(assetRoot)) return new Response(null, { status: 403 });
        if (!path.extname(filename) || !existsSync(filename)) filename = path.join(assetRoot, 'index.html');
        const asset = readFileSync(filename);
        // Cloudflare Web Analytics injects this script outside the repository.
        const content = path.extname(filename) === '.html' ? asset.toString().replace('</head>', '<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script></head>') : asset;
        return new Response(content, { headers: { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' } });
      } },
    });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  })().catch(() => { response.writeHead(500).end(); });
}).listen(18887, '127.0.0.1');
console.log('Isolated test API ready:', String(await mf.ready));
const stop = () => { fixtureServer.close(); productionFixture.close(); rmSync(certificates, { recursive: true, force: true }); void mf.dispose().then(() => process.exit(0)); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
