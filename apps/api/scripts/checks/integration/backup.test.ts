import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness';

type BackupTools = {
  captureBackup(query: (sql: string) => Promise<Record<string, unknown>[]>): Promise<unknown>;
  encryptBackup(backup: unknown, key: string): string;
  decryptBackup(encrypted: string, key: string): unknown;
  restoreStatements(backup: unknown): string[];
};

void test('encrypted Gokkan backup restores into a NEW D1 with identical values, FK checks and namespace isolation', { timeout: 45_000 }, async () => {
  const tools = await import(new URL('../../../../../scripts/data-backup.mjs', import.meta.url).href) as BackupTools;
  const source = await createHarness();
  const target = await createHarness(undefined, false, {}, false);
  try {
    await source.db.prepare("CREATE TABLE other_app_records (id TEXT PRIMARY KEY, secret TEXT)").run();
    await source.db.prepare("INSERT INTO other_app_records VALUES ('other', 'unrelated-app-secret')").run();
    await source.db.prepare("INSERT INTO gk_granaries (id, name, purpose, currency, owner) VALUES ('backup-fixture', 'Owner''s reserve', '비상금', 'USD', 'fixture')").run();
    await source.db.prepare("INSERT INTO gk_positions (id, granary_id, name, symbol, quantity, created_at, updated_at) VALUES ('fraction', 'backup-fixture', 'Fractional fixture', 'TEST', ?, ?, ?)").bind(0.12345678901234567, '2026-10-09T00:00:00.000Z', '2026-10-09T00:00:00.000Z').run();
    await source.db.prepare("INSERT INTO gk_sessions VALUES ('do-not-restore-auth', 9999999999)").run();
    const query = async (sql: string) => (await source.db.prepare(sql).all<Record<string, unknown>>()).results;
    const backup = await tools.captureBackup(query);
    const key = 'ab'.repeat(32);
    const encrypted = tools.encryptBackup(backup, key);
    assert.ok(!encrypted.includes("Owner's reserve"));
    assert.ok(!JSON.stringify(backup).includes('unrelated-app-secret'));
    assert.ok(!JSON.stringify(backup).includes('do-not-restore-auth'));
    assert.throws(() => tools.decryptBackup(encrypted, 'cd'.repeat(32)));
    const decrypted = tools.decryptBackup(encrypted, key);
    for (const statement of tools.restoreStatements(decrypted)) await target.db.prepare(statement).run();
    assert.equal((await target.db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
    const granary = await target.db.prepare("SELECT name FROM gk_granaries WHERE id = 'backup-fixture'").first<{ name: string }>();
    assert.equal(granary?.name, "Owner's reserve");
    assert.equal((await target.db.prepare("SELECT quantity FROM gk_positions WHERE id = 'fraction'").first<{ quantity: number }>())?.quantity, 0.12345678901234567);
    assert.equal(await target.db.prepare("SELECT name FROM sqlite_schema WHERE name = 'other_app_records'").first(), null);
    assert.equal(await target.db.prepare('SELECT id FROM gk_sessions').first(), null);
    await assert.rejects(target.db.prepare("UPDATE gk_granaries SET currency = 'KRW' WHERE id = 'backup-fixture'").run(), /granary_currency_locked/);
    await target.db.prepare("UPDATE gk_granaries SET name = 'Restored fixture' WHERE id = 'backup-fixture'").run();
    assert.ok(await target.db.prepare("SELECT id FROM gk_data_revisions WHERE record_id = 'backup-fixture'").first());
    for (const [sql, index] of [
      ["SELECT * FROM gk_cash_flows WHERE granary_id = 'backup-fixture' ORDER BY date DESC, id DESC", 'idx_gk_cash_flows_granary_date'],
      ['SELECT * FROM gk_snapshots ORDER BY date DESC, id DESC LIMIT 50', 'idx_gk_snapshots_date'],
      ["SELECT * FROM gk_positions WHERE granary_id = 'backup-fixture' ORDER BY updated_at DESC, id DESC", 'idx_gk_positions_granary_updated'],
      ['SELECT * FROM gk_positions ORDER BY updated_at DESC, id DESC', 'idx_gk_positions_updated'],
      ['SELECT * FROM gk_positions WHERE is_public = 1 ORDER BY public_order ASC, updated_at DESC, id DESC', 'idx_gk_positions_public_sorted'],
      ['SELECT * FROM gk_alert_log ORDER BY sent_at DESC, id DESC LIMIT 50', 'idx_gk_alert_log_sent'],
      ["SELECT * FROM gk_judgment_diary_entries WHERE action = 'WATCH' AND created_at >= '2026-10-01' AND created_at < '2026-11-01' ORDER BY created_at DESC, id DESC LIMIT 50", 'idx_gk_diary_action_created'],
    ]) {
      const plan = JSON.stringify((await target.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all()).results);
      assert.ok(plan.includes(index), plan); assert.ok(!plan.includes('USE TEMP B-TREE'), plan);
    }
  } finally { await target.mf.dispose(); await source.mf.dispose(); }
});
