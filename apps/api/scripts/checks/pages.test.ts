import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../web/server/worker';

void test('Pages redirects previews and proxies method, query, body, cookie, and response cookie', async () => {
  const original = globalThis.fetch;
  const assets = { fetch: async () => new Response('fixture asset') };
  globalThis.fetch = async (input) => {
    assert.ok(input instanceof Request);
    assert.equal(input.url, 'https://gokkan-keeper-api-production.amansman77.workers.dev/auth/google?next=%2Fdashboard');
    assert.equal(input.method, 'POST'); assert.equal(input.headers.get('cookie'), 'gk_session=fixture');
    assert.equal(await input.text(), '{"credential":"fixture"}');
    return new Response('fixture response', { status: 201, headers: { 'Set-Cookie': 'gk_session=new; HttpOnly' } });
  };
  try {
    const redirect = await worker.fetch(new Request('https://preview.pages.dev/archive?q=one'), { ASSETS: assets });
    assert.equal(redirect.status, 301); assert.equal(redirect.headers.get('location'), 'https://gokkan-keeper.yetimates.com/archive?q=one');
    const response = await worker.fetch(new Request('https://gokkan-keeper.yetimates.com/api/auth/google?next=%2Fdashboard', { method: 'POST', headers: { Cookie: 'gk_session=fixture' }, body: '{"credential":"fixture"}' }), { ASSETS: assets });
    assert.equal(response.status, 201); assert.equal(await response.text(), 'fixture response');
    assert.equal(response.headers.get('set-cookie'), 'gk_session=new; HttpOnly');
    assert.equal(await (await worker.fetch(new Request('https://gokkan-keeper.yetimates.com/archive'), { ASSETS: assets })).text(), 'fixture asset');
  } finally { globalThis.fetch = original; }
});
void test('sitemap escapes valid entries, ignores malformed data, and falls back on provider failure', async () => {
  const original = globalThis.fetch;
  const env = { ASSETS: { fetch: async () => new Response('unused') } };
  try {
    globalThis.fetch = async () => Response.json([{ title: 'Decision & reasoning', updatedAt: 'invalid-date' }, null, { title: '' }]);
    let response = await worker.fetch(new Request('https://gokkan-keeper.yetimates.com/sitemap.xml'), env);
    assert.equal(response.status, 200); assert.ok((await response.text()).includes('/judgment-diary/decision-reasoning'));
    globalThis.fetch = async () => { throw new Error('fixture offline'); };
    response = await worker.fetch(new Request('https://gokkan-keeper.yetimates.com/sitemap.xml'), env);
    assert.equal(response.status, 200); assert.ok((await response.text()).includes('/archive'));
  } finally { globalThis.fetch = original; }
});
