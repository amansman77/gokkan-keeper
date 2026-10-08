import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness';
import { computeIndicatorsFromRows } from '../../../src/services/technical-indicators';

void test('alert state only fires on transitions, deduplicates the same day, and requires an operational secret', { timeout: 45_000 }, async () => {
  const { mf, db, outbound } = await createHarness(undefined, true);
  try {
    const url = 'http://localhost/alerts/run/weekly';
    assert.equal((await mf.dispatchFetch(url, { method: 'POST' })).status, 401);
    const response = await mf.dispatchFetch('http://localhost/positions', { method: 'POST', headers: { 'X-API-Secret': 'fixture-only-api-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Alert fixture', symbol: 'TEST', quantity: 1 }) });
    assert.equal(response.status, 201);
    const base = computeIndicatorsFromRows([{ ts: 1767225600, open: 100, high: 101, low: 99, close: 100, volume: 100 }], 'TEST');
    async function cache(close: number) {
      for (const interval of ['1d', '1wk']) {
        const value = interval === '1wk' ? { ...base, prevClose: 100, prevMa40: 100, ma40: 99, close } : base;
        await db.prepare(`INSERT OR REPLACE INTO gk_quote_cache (cache_key, short_code, operation, quote_json, is_not_found, fetched_at, expires_at) VALUES (?, 'TEST', 'INDICATORS', ?, 0, ?, ?)`)
          .bind(`INDICATORS:${interval}:TEST`, JSON.stringify(value), new Date().toISOString(), new Date(Date.now()+3600_000).toISOString()).run();
      }
    }
    const run = async () => {
      const response = await mf.dispatchFetch(url, { method: 'POST', headers: { 'X-API-Secret': 'fixture-only-api-secret' } });
      assert.equal(response.status, 200);
      return (await response.json() as { sent: number }).sent;
    };
    await cache(98); assert.equal(await run(), 1); assert.equal(await run(), 0);
    await cache(101); assert.equal(await run(), 0);
    await cache(98); assert.equal(await run(), 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM gk_alert_log').first<{ count: number }>())?.count, 1);
    assert.equal(outbound.filter((url) => url === 'https://discord.fixture/alerts').length, 1);
    await cache(101); await run();
    await db.prepare('DELETE FROM gk_alert_sent').run();
    await db.prepare('DELETE FROM gk_alert_outbox').run();
    await cache(98); assert.equal(await run(), 1);
    assert.equal(outbound.filter((url) => url === 'https://discord.fixture/alerts').length, 2);
  } finally { await mf.dispose(); }
});
