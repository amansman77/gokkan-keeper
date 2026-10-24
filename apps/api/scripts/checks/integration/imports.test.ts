import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness';
import { krCashPage, krHoldingsPage } from '../screenshot-fixtures';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
const ACCOUNT = '0000001234-01';
const rows = [
  { name: '대한전선', quantity: 9, marketValue: '189,900', profitLoss: '-53,514', percent: '-21.98%' },
  { name: '파두', quantity: 2, marketValue: '94,000', profitLoss: '73,080', percent: '349.33%' },
];

void test('screenshot import: owner uploads, worker reads and reports OCR, owner applies once checks pass', { timeout: 60_000 }, async () => {
  const { mf, db, credential } = await createHarness();
  try {
    const login = await mf.dispatchFetch('http://localhost/auth/google', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const owner = (path: string, method = 'GET', body?: unknown) => mf.dispatchFetch(`http://localhost${path}`, {
      method, headers: { Origin: 'http://localhost', Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const image = (bytes: Uint8Array, mime = 'image/png') => ({ mime, data: Buffer.from(bytes).toString('base64') });
    const worker = (path: string, method = 'GET', body?: unknown) => mf.dispatchFetch(`http://localhost${path}`, {
      method, headers: { 'X-API-Secret': 'fixture-only-api-secret', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });

    const granary = await (await owner('/granaries', 'POST', { name: 'Import fixture', purpose: '가계', currency: 'KRW' })).json() as { id: string };
    const position = await (await owner('/positions', 'POST', { granaryId: granary.id, name: '파두', symbol: '440110', quantity: 1, avgCost: 10460 })).json() as { id: string };
    await owner('/positions', 'POST', { granaryId: granary.id, name: '대한전선', symbol: '001440', quantity: 9, avgCost: 27046 });

    // workers cannot create jobs, owners cannot lease them
    assert.equal((await worker('/imports', 'POST', { granaryId: granary.id })).status, 403);
    assert.equal((await owner('/imports/next')).status, 403);

    const job = await (await owner('/imports', 'POST', { granaryId: granary.id })).json() as { id: string; status: string };
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

    const pages = [krHoldingsPage(1, ACCOUNT, '19.566원 4.1%', rows), krCashPage(2, ACCOUNT, '500,000')];
    assert.equal((await worker(`/imports/${job.id}/ocr`, 'POST', { pages })).status, 204);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gk_import_images WHERE job_id = ?').bind(job.id).first<{ n: number }>())?.n, 0);

    const parsed = await (await owner(`/imports/${job.id}`)).json() as { status: string; result: { checks: { passed: boolean }[]; proposal: { changes: { positionId: string }[] } } };
    assert.equal(parsed.status, 'parsed');
    assert.ok(parsed.result.checks.every((c) => c.passed));
    assert.deepEqual(parsed.result.proposal.changes.map((c) => c.positionId), [position.id]);

    assert.equal(((await (await owner(`/imports/${job.id}/apply`, 'POST', {})).json()) as { status: string }).status, 'applied');
    const updated = await (await owner(`/positions/${position.id}`)).json() as { quantity: number; avgCost: number };
    assert.deepEqual([updated.quantity, updated.avgCost], [2, 10460]);
    const snapshot = await db.prepare('SELECT total_amount, available_balance, profit_loss FROM gk_snapshots WHERE granary_id = ?').bind(granary.id).first<Record<string, number>>();
    assert.deepEqual(snapshot, { total_amount: 783900, available_balance: 500000, profit_loss: 19566 });
    assert.equal((await db.prepare('SELECT account_suffix FROM gk_import_accounts WHERE granary_id = ?').bind(granary.id).first<{ account_suffix: string }>())?.account_suffix, '1234');
    assert.equal((await owner(`/imports/${job.id}/apply`, 'POST', {})).status, 409);

    // the granary is now tied to account …1234; another account's screens are refused
    const second = await (await owner('/imports', 'POST', { granaryId: granary.id })).json() as { id: string };
    await owner(`/imports/${second.id}/images/1`, 'PUT', image(png));
    await owner(`/imports/${second.id}/submit`, 'POST', {});
    await worker('/imports/next');
    await worker(`/imports/${second.id}/ocr`, 'POST', { pages: [krHoldingsPage(1, '0000009999-01', '19.566원', rows), krCashPage(2, '0000009999-01', '1')] });
    assert.equal((await owner(`/imports/${second.id}/apply`, 'POST', {})).status, 409);
  } finally {
    await mf.dispose();
  }
});
