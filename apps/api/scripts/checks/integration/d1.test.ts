import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness';

void test('Worker applies all migrations and persists CRUD with constraints and publication boundaries', { timeout: 45_000 }, async () => {
  const { mf, db, outbound, credential } = await createHarness();
  try {
    const login = await mf.dispatchFetch('http://localhost/auth/google', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const call = (path: string, method = 'GET', data?: unknown, authenticated = true) => mf.dispatchFetch(`http://localhost${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie, Origin: 'http://localhost' } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const created = await call('/granaries', 'POST', { name: 'Private reserve', purpose: '비상금', currency: 'KRW' });
    assert.equal(created.status, 201);
    const granary = await created.json() as { id: string };
    assert.equal((await call('/granaries', 'GET', undefined, false)).status, 401);
    assert.equal((await call(`/granaries/${granary.id}`, 'PUT', { name: 'Updated reserve' })).status, 200);
    assert.equal((await db.prepare('SELECT name FROM gk_granaries WHERE id = ?').bind(granary.id).first<{ name: string }>())?.name, 'Updated reserve');
    assert.equal((await call('/snapshots', 'POST', { granaryId: granary.id, date: '2026-10-09', totalAmount: 100 })).status, 201);
    assert.equal((await call('/snapshots', 'POST', { granaryId: granary.id, date: '2026-10-09', totalAmount: 200 })).status, 409);
    assert.equal((await call('/snapshots', 'POST', { granaryId: granary.id, date: '2026-10-10', totalAmount: -1 })).status, 400);
    const cash = await call('/cash-flows', 'POST', { granaryId: granary.id, date: '2026-10-09', type: 'DEPOSIT', amount: 10 });
    assert.equal(cash.status, 201);
    const flow = await cash.json() as { id: string };
    assert.equal((await call(`/cash-flows/${flow.id}`, 'PATCH', { amount: 20 })).status, 200);
    assert.equal((await db.prepare('SELECT amount FROM gk_cash_flows WHERE id = ?').bind(flow.id).first<{ amount: number }>())?.amount, 20);
    assert.equal((await call(`/cash-flows/${flow.id}`, 'DELETE')).status, 200);
    assert.equal(await db.prepare('SELECT id FROM gk_cash_flows WHERE id = ?').bind(flow.id).first(), null);
    for (const isPublic of [false, true]) {
      const response = await call('/positions', 'POST', { granaryId: granary.id, name: isPublic ? 'Published cash' : 'Hidden cash', symbol: 'KRW', assetType: 'CASH', currentValue: 100, isPublic, publicThesis: isPublic ? 'Published reasoning' : 'Private reasoning', note: 'Private owner note' });
      assert.equal(response.status, 201);
    }
    for (const path of ['/public/portfolio', '/api/public/portfolio']) {
      const response = await call(path, 'GET', undefined, false);
      assert.equal(response.status, 200);
      const portfolio = await response.json() as { data: { name: string }[] };
      assert.equal(portfolio.data.length, 1);
      assert.equal(portfolio.data[0].name, 'Published cash');
      assert.ok(!JSON.stringify(portfolio).includes('Hidden cash'));
      assert.ok(!JSON.stringify(portfolio).includes('Private owner note'));
      assert.ok(!JSON.stringify(portfolio).includes('Private reasoning'));
    }
    assert.deepEqual(outbound, ['https://www.googleapis.com/oauth2/v3/certs']);
  } finally { await mf.dispose(); }
});
