import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { D1Database } from '@cloudflare/workers-types';
import { createHarness } from './harness';
import { krCashPage, krHoldingsPage } from '../screenshot-fixtures';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
const ACCOUNT = '0000001234-01';
const WORKER_KEY = 'fixture-ocr-worker-key-with-at-least-32-chars';
const rows = [
  { name: '대한전선', quantity: 9, marketValue: '189,900', profitLoss: '-53,514', percent: '-21.98%' },
  { name: '파두', quantity: 2, marketValue: '94,000', profitLoss: '73,080', percent: '349.33%' },
  { name: '코리아써키트', quantity: 4, marketValue: '268,000', profitLoss: '91,300', percent: '51.67%' },
];

type Call = (path: string, method?: string, body?: unknown) => Promise<Response>;
const image = (bytes: Uint8Array, mime = 'image/png') => ({ mime, data: Buffer.from(bytes).toString('base64') });
const count = async (db: D1Database, sql: string, ...args: string[]) => (await db.prepare(sql).bind(...args).first<{ n: number }>())?.n;

/** Upload with input validation, submit, and lease the job as the Mac worker. */
async function uploadAndLease(owner: Call, worker: Call, granaryId: string): Promise<string> {
  const job = await (await owner('/imports', 'POST', { granaryId })).json() as { id: string; status: string };
  assert.equal(job.status, 'draft');
  assert.equal((await owner(`/imports/${job.id}/images/1`, 'PUT', image(new Uint8Array([1, 2, 3])))).status, 400);
  assert.equal((await owner(`/imports/${job.id}/images/1`, 'PUT', image(png, 'text/plain'))).status, 400);
  assert.equal((await owner(`/imports/${job.id}/images/13`, 'PUT', image(png))).status, 400);
  for (const seq of [1, 2]) assert.equal((await owner(`/imports/${job.id}/images/${seq}`, 'PUT', image(png))).status, 204);
  assert.equal(((await (await owner(`/imports/${job.id}/submit`, 'POST', {})).json()) as { status: string }).status, 'queued');
  const leased = await (await worker('/imports/next')).json() as { id: string; images: { seq: number }[] };
  assert.equal(leased.id, job.id);
  assert.deepEqual(leased.images.map((i) => i.seq), [1, 2]);
  assert.equal((await worker('/imports/next')).status, 204);
  const stored = await worker(`/imports/${job.id}/images/1`);
  assert.equal(stored.headers.get('content-type'), 'image/png');
  assert.deepEqual(new Uint8Array(await stored.arrayBuffer()), new Uint8Array(png));
  return job.id;
}

void test('screenshot import: owner uploads, worker reads and reports OCR, owner applies once checks pass', { timeout: 60_000 }, async () => {
  const { mf, db, credential } = await createHarness(undefined, false, { AUTOMATION_API_KEYS: JSON.stringify([{ id: 'ocr-import', secret: WORKER_KEY, scopes: ['imports:process'] }]) });
  try {
    const login = await mf.dispatchFetch('http://localhost/auth/google', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const as = (headers: Record<string, string>): Call => (path, method = 'GET', body) => mf.dispatchFetch(`http://localhost${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
    }) as unknown as Promise<Response>;
    const owner = as({ Origin: 'http://localhost', Cookie: cookie });
    const worker = as({ 'X-API-Secret': WORKER_KEY });

    const granary = await (await owner('/granaries', 'POST', { name: 'Import fixture', purpose: '가계', currency: 'KRW' })).json() as { id: string };
    const position = await (await owner('/positions', 'POST', { granaryId: granary.id, name: '파두', symbol: '440110', quantity: 1, avgCost: 10460 })).json() as { id: string };
    await owner('/positions', 'POST', { granaryId: granary.id, name: '대한전선', symbol: '001440', quantity: 9, avgCost: 27046 });
    // held in another granary: its symbol is suggested for the new holding
    const other = await (await owner('/granaries', 'POST', { name: 'Other', purpose: '비상금', currency: 'KRW' })).json() as { id: string };
    await owner('/positions', 'POST', { granaryId: other.id, name: '코리아써키트', symbol: '007810', market: 'KOSPI', quantity: 2, avgCost: 10049 });

    // workers cannot create jobs; owners and the shared legacy secret cannot lease them
    assert.equal((await worker('/imports', 'POST', { granaryId: granary.id })).status, 403);
    assert.equal((await owner('/imports/next')).status, 403);
    assert.equal((await as({ 'X-API-Secret': 'fixture-only-api-secret' })('/imports/next')).status, 403);

    const jobId = await uploadAndLease(owner, worker, granary.id);
    assert.equal((await worker(`/imports/${jobId}/ocr`, 'POST', { pages: [krHoldingsPage(1, ACCOUNT, '110.866원 4.1%', rows), krCashPage(2, ACCOUNT, '500,000')] })).status, 204);
    assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM gk_import_images WHERE job_id = ?', jobId), 0);

    const parsed = await (await owner(`/imports/${jobId}`)).json() as { status: string; result: { checks: { passed: boolean }[]; proposal: { changes: { positionId: string }[]; newHoldings: { suggestion: { symbol: string } }[] } } };
    assert.equal(parsed.status, 'parsed');
    assert.ok(parsed.result.checks.every((c) => c.passed));
    assert.deepEqual(parsed.result.proposal.changes.map((c) => c.positionId), [position.id]);
    assert.deepEqual(parsed.result.proposal.newHoldings.map((n) => n.suggestion.symbol), ['007810']);

    assert.equal(((await (await owner(`/imports/${jobId}/apply`, 'POST', { createNew: [0] })).json()) as { status: string }).status, 'applied');
    const created = await db.prepare('SELECT symbol, quantity, avg_cost, source FROM gk_positions WHERE granary_id = ? AND symbol = ?').bind(granary.id, '007810').all();
    assert.deepEqual(created.results, [{ symbol: '007810', quantity: 4, avg_cost: 44175, source: 'screenshot-import' }]);
    const updated = await (await owner(`/positions/${position.id}`)).json() as { quantity: number; avgCost: number };
    assert.deepEqual([updated.quantity, updated.avgCost], [2, 10460]);
    const snapshot = await db.prepare('SELECT total_amount, available_balance, profit_loss FROM gk_snapshots WHERE granary_id = ?').bind(granary.id).first<Record<string, number>>();
    assert.deepEqual(snapshot, { total_amount: 1051900, available_balance: 500000, profit_loss: 110866 });
    assert.equal((await db.prepare('SELECT account_suffix FROM gk_import_accounts WHERE granary_id = ?').bind(granary.id).first<{ account_suffix: string }>())?.account_suffix, '1234');
    // a repeated apply writes nothing
    assert.equal((await owner(`/imports/${jobId}/apply`, 'POST', { createNew: [0] })).status, 409);
    assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM gk_positions WHERE granary_id = ? AND symbol = ?', granary.id, '007810'), 1);

    // the granary is now tied to account …1234; another account's screens are refused
    const second = await (await owner('/imports', 'POST', { granaryId: granary.id })).json() as { id: string };
    await owner(`/imports/${second.id}/images/1`, 'PUT', image(png));
    await owner(`/imports/${second.id}/submit`, 'POST', {});
    await worker('/imports/next');
    await worker(`/imports/${second.id}/ocr`, 'POST', { pages: [krHoldingsPage(1, '0000009999-01', '110.866원', rows), krCashPage(2, '0000009999-01', '1')] });
    assert.equal((await owner(`/imports/${second.id}/apply`, 'POST', {})).status, 409);
  } finally {
    await mf.dispose();
  }
});
