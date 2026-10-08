import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness';
import { AlertDeliveryRepository } from '../../../src/db/repositories/alert-delivery-repository';
import type { D1Database } from '@cloudflare/workers-types';
import { SecurityRepository } from '../../../src/db/repositories/security-repository';

void test('calendar dates, currency history, exact cash and source identity are protected in Worker/D1', { timeout: 45_000 }, async () => {
  const { mf, db, credential } = await createHarness();
  try {
    const login = await mf.dispatchFetch('http://localhost/auth/google', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const call = (path: string, method: string, data: unknown) => mf.dispatchFetch(`http://localhost${path}`, {
      method, headers: { Origin: 'http://localhost', Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const granary = await (await call('/granaries', 'POST', { name: 'DB fixture', purpose: '비상금', currency: 'KRW' })).json() as { id: string };
    assert.equal((await call(`/granaries/${granary.id}`, 'PUT', { currency: 'USD' })).status, 200);
    for (const date of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-01']) {
      assert.equal((await call('/snapshots', 'POST', { granaryId: granary.id, date, totalAmount: 100 })).status, 400);
      assert.equal((await call('/cash-flows', 'POST', { granaryId: granary.id, date, type: 'DEPOSIT', amount: 10 })).status, 400);
    }
    assert.equal((await call('/snapshots', 'POST', { granaryId: granary.id, date: '2024-02-29', totalAmount: 100 })).status, 201);
    assert.equal((await call(`/granaries/${granary.id}`, 'PUT', { currency: 'KRW' })).status, 409);
    await assert.rejects(db.prepare('UPDATE gk_granaries SET currency = ? WHERE id = ?').bind('KRW', granary.id).run(), /granary_currency_locked/);
    assert.equal((await db.prepare('SELECT currency FROM gk_granaries WHERE id = ?').bind(granary.id).first<{ currency: string }>())?.currency, 'USD');
    for (const [date, amount] of [['2026-02-30', 10], ['2026-10-09', -1]] as const) {
      await assert.rejects(db.prepare('INSERT INTO gk_snapshots (id, granary_id, date, total_amount) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), granary.id, date, amount).run(), /invalid_record/);
    }
    assert.equal((await call('/cash-flows', 'POST', { granaryId: granary.id, date: '2026-10-09', type: 'DEPOSIT', amount: 1.001 })).status, 400);
    const flow = await (await call('/cash-flows', 'POST', { granaryId: granary.id, date: '2026-10-09', type: 'DEPOSIT', amount: 1.23 })).json() as { id: string; amountMinor: number; currency: string };
    assert.equal(flow.amountMinor, 123); assert.equal(flow.currency, 'USD');
    await assert.rejects(db.prepare('UPDATE gk_cash_flows SET amount = 9 WHERE id = ?').bind(flow.id).run(), /cash_flow_money_mismatch/);
    assert.equal((await call(`/cash-flows/${flow.id}`, 'PATCH', { amount: 2.34 })).status, 200);
    const revision = await db.prepare("SELECT previous_json FROM gk_data_revisions WHERE table_name = 'gk_cash_flows' AND record_id = ? ORDER BY id DESC LIMIT 1").bind(flow.id).first<{ previous_json: string }>();
    assert.equal((JSON.parse(revision!.previous_json) as { amount_minor: number }).amount_minor, 123);
    const input = { granaryId: granary.id, name: 'Synced fixture', symbol: 'TEST', quantity: 1, currentValue: 10, priceCurrency: 'USD', source: 'fixture', sourceRecordId: 'account:holding' };
    const responses = await Promise.all(Array.from({ length: 4 }, () => call('/positions', 'POST', input)));
    const holdings = await Promise.all(responses.map(async (response) => { assert.equal(response.status, 201); return response.json() as Promise<{ id: string; currentValueKind: string }>; }));
    assert.equal(new Set(holdings.map((p) => p.id)).size, 1); assert.equal(holdings[0].currentValueKind, 'UNIT_PRICE');
    assert.equal((await call('/positions', 'POST', { ...input, sourceRecordId: undefined })).status, 400);
    assert.equal((await call('/settings/weekly_report_rsi_oversold', 'PATCH', { value: '80' })).status, 400);
    assert.equal((await call('/settings/weekly_report_rsi_oversold', 'PATCH', { value: 'NaN' })).status, 400);
    assert.equal((await call('/settings/asset_goal_plan', 'PATCH', { value: '{}' })).status, 400);
    assert.equal((await mf.dispatchFetch('http://localhost/judgment-diary?to=2026-02-30')).status, 400);
    await assert.rejects(db.prepare('UPDATE gk_positions SET is_public = 3 WHERE id = ?').bind(holdings[0].id).run(), /invalid_record/);
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
  } finally { await mf.dispose(); }
});

void test('outbox retries HTTP/network failures, serializes concurrent senders, and atomically commits transitions', { timeout: 45_000 }, async () => {
  const { mf, db } = await createHarness();
  const workerDb = db as unknown as D1Database;
  const delivery = new AlertDeliveryRepository(workerDb);
  const pending = { symbol: 'TEST', ruleId: 'FIXTURE', date: '2026-10-09', priority: 'P0', status: 'CONFIRMED', action: 'fixture', indicators: {}, payload: { embeds: [] } };
  try {
    await Promise.all(Array.from({ length: 5 }, () => delivery.transition('TEST', 'FIXTURE', true, pending)));
    let attempts = 0;
    const failing: typeof fetch = () => { attempts++; return Promise.resolve(new Response(null, { status: 500 })); };
    assert.equal(await delivery.deliver('https://fixture.invalid', failing, 100), 0);
    assert.equal(attempts, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gk_alert_sent').first<{ n: number }>())?.n, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gk_alert_log').first<{ n: number }>())?.n, 0);
    await delivery.transition('TEST', 'FIXTURE', true, pending); // same true condition cannot lose the retry
    const offline: typeof fetch = () => { attempts++; return Promise.reject(new Error('sensitive URL must not persist')); };
    assert.equal(await delivery.deliver('https://fixture.invalid', offline, 160), 0);
    assert.equal((await db.prepare('SELECT last_error FROM gk_alert_outbox').first<{ last_error: string }>())?.last_error, 'delivery_failed');
    const success: typeof fetch = () => { attempts++; return Promise.resolve(new Response(null, { status: 204 })); };
    assert.equal(await delivery.deliver('https://fixture.invalid', success, 279), 0);
    const counts = await Promise.all(Array.from({ length: 5 }, () => delivery.deliver('https://fixture.invalid', success, 280)));
    assert.equal(counts.reduce((sum, count) => sum + count, 0), 1); assert.equal(attempts, 3);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gk_alert_log').first<{ n: number }>())?.n, 1);
    assert.equal(await delivery.deliver('https://fixture.invalid', success, 500), 0);
    // A failed insert must roll back the state UPSERT as well.
    await db.prepare("CREATE TRIGGER fixture_state_failure BEFORE INSERT ON gk_alert_rule_state WHEN NEW.symbol = 'BAD' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END").run();
    await assert.rejects(delivery.transition('BAD', 'FIXTURE', true, { ...pending, symbol: 'BAD' }));
    assert.equal(await db.prepare("SELECT alert_key FROM gk_alert_outbox WHERE symbol = 'BAD'").first(), null);
    assert.equal(await db.prepare("SELECT * FROM gk_alert_rule_state WHERE symbol = 'BAD'").first(), null);
    await assert.rejects(delivery.transition('INVALID', 'FIXTURE', true, { ...pending, symbol: 'INVALID', priority: null as unknown as string }));
    assert.equal(await db.prepare("SELECT symbol FROM gk_alert_rule_state WHERE symbol = 'INVALID'").first(), null);
    // An abandoned claim becomes retryable after its lease expires.
    await delivery.transition('LEASE', 'FIXTURE', true, { ...pending, symbol: 'LEASE' });
    await db.prepare("UPDATE gk_alert_outbox SET lease_until = 900, lease_token = 'abandoned' WHERE symbol = 'LEASE'").run();
    assert.equal(await delivery.deliver('https://fixture.invalid', success, 899), 0);
    assert.equal(await delivery.deliver('https://fixture.invalid', success, 900), 1);
    // Cleanup prunes only expired cache / old delivered rows, keeping pending and history.
    await delivery.transition('PENDING', 'FIXTURE', true, { ...pending, symbol: 'PENDING' });
    await new SecurityRepository(workerDb).cleanup(Math.floor(Date.now() / 1000) + 91 * 86400);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gk_alert_outbox WHERE delivered_at IS NULL').first<{ n: number }>())?.n, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gk_alert_log').first<{ n: number }>())?.n, 2);
  } finally { await mf.dispose(); }
});

void test('delivery bookkeeping rolls back on DB failure after Discord success and remains retryable', { timeout: 45_000 }, async () => {
  const { mf, db } = await createHarness();
  const delivery = new AlertDeliveryRepository(db as unknown as D1Database);
  try {
    await delivery.transition('DBFAIL', 'FIXTURE', true, { symbol: 'DBFAIL', ruleId: 'FIXTURE', date: '2026-10-09', priority: 'P0', status: 'CONFIRMED', action: 'fixture', indicators: {}, payload: {} });
    await db.prepare("CREATE TRIGGER fixture_log_failure BEFORE INSERT ON gk_alert_log BEGIN SELECT RAISE(ABORT, 'fixture failure'); END").run();
    let calls = 0;
    const send: typeof fetch = () => { calls++; return Promise.resolve(new Response(null, { status: 204 })); };
    assert.equal(await delivery.deliver('https://fixture.invalid', send, 100), 0);
    assert.equal(await db.prepare('SELECT alert_key FROM gk_alert_sent').first(), null);
    assert.equal((await db.prepare('SELECT delivered_at FROM gk_alert_outbox').first<{ delivered_at: string | null }>())?.delivered_at, null);
    await db.prepare('DROP TRIGGER fixture_log_failure').run();
    assert.equal(await delivery.deliver('https://fixture.invalid', send, 160), 1);
    assert.equal(calls, 2); // unavoidable external retry after an ambiguous success
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gk_alert_log').first<{ n: number }>())?.n, 1);
  } finally { await mf.dispose(); }
});
