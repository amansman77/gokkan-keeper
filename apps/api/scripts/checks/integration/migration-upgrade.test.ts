import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { createHarness } from './harness';

void test('DBA migrations preserve populated legacy records, references and fractional valuations', { timeout: 45_000 }, async () => {
  const { mf, db } = await createHarness(undefined, false, {}, false);
  try {
    const directory = new URL('../../../../../migrations/', import.meta.url);
    const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    const apply = async (name: string) => { for (const sql of splitSqlQuery(await readFile(new URL(name, directory), 'utf8'))) await db.prepare(sql).run(); };
    for (const name of names.filter((name) => name < '0017')) await apply(name);
    await db.prepare("INSERT INTO gk_granaries (id, name, purpose, currency, owner) VALUES ('legacy', 'Legacy fixture', '비상금', 'KRW', 'fixture')").run();
    await db.prepare("INSERT INTO gk_snapshots (id, granary_id, date, total_amount) VALUES ('legacy-snapshot', 'legacy', '2026-10-09', 123.456)").run();
    await db.prepare("INSERT INTO gk_cash_flows (id, granary_id, date, type, amount, created_at, updated_at) VALUES ('legacy-cash', 'legacy', '2026-10-09', 'DEPOSIT', 1.5, '2026-10-09', '2026-10-09')").run();
    for (const id of ['lot-a', 'lot-b']) await db.prepare("INSERT INTO gk_positions (id, granary_id, name, symbol, quantity, current_value, created_at, updated_at) VALUES (?, 'legacy', 'Legacy lot', 'TEST', 0.012345678901234567, 12.34567, '2026-10-09', '2026-10-09')").bind(id).run();
    const before = await db.prepare('SELECT id, quantity, current_value FROM gk_positions ORDER BY id').all();
    for (const name of names.filter((name) => name >= '0017')) await apply(name);
    assert.deepEqual((await db.prepare('SELECT id, quantity, current_value FROM gk_positions ORDER BY id').all()).results, before.results);
    const cash = await db.prepare("SELECT amount, amount_minor, money_currency FROM gk_cash_flows WHERE id = 'legacy-cash'").first();
    assert.deepEqual(cash, { amount: 1.5, amount_minor: null, money_currency: null });
    assert.equal((await db.prepare("SELECT total_amount FROM gk_snapshots WHERE id = 'legacy-snapshot'").first<{ total_amount: number }>())?.total_amount, 123.456);
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
    await assert.rejects(db.prepare("UPDATE gk_granaries SET currency = 'USD' WHERE id = 'legacy'").run(), /granary_currency_locked/);
    await db.prepare("UPDATE gk_cash_flows SET memo = 'Legacy amount preserved' WHERE id = 'legacy-cash'").run();
    assert.equal((await db.prepare("SELECT amount FROM gk_cash_flows WHERE id = 'legacy-cash'").first<{ amount: number }>())?.amount, 1.5);
  } finally { await mf.dispose(); }
});
