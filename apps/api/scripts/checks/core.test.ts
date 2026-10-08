import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, type AlertRuleContext } from '../../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../../src/services/technical-indicators';
import { getPositionMarketValue, normalizeInternalPath, calculateComparison, validatePublicPositionInput } from '../../../../packages/shared/src/utils';
import { MarketQuoteService, loadQuotesForTargets, enrichPositionWithQuote, enrichPositionsWithLiveQuotes } from '../../src/services/market-price';
import type { Env } from '../../src/types';
import type { Position } from '@gokkan-keeper/shared';

const bars = (count: number, close: (i: number) => number): OhlcvRow[] => Array.from({ length: count }, (_, i) => ({ ts: Date.UTC(2026, 0, 1+i)/1000, open: close(i), close: close(i), high: close(i)+1, low: close(i)-1, volume: 100 }));
const base = computeIndicatorsFromRows(bars(1, () => 100), 'TEST');
void test('indicators match independent trend values and warm-up requirements', () => {
  const rising = computeIndicatorsFromRows(bars(80, (i) => i+1), 'TEST');
  assert.equal(rising.ma5, 78); assert.equal(rising.ma20, 70.5); assert.equal(rising.ma40, 60.5);
  assert.equal(rising.prevMa40, 59.5); assert.equal(rising.rsi, 100); assert.equal(rising.obv, 7900);
  assert.equal(rising.adx, 100); assert.equal(rising.fiveDayReturn, 5/75);
  assert.equal(computeIndicatorsFromRows(bars(80, (i) => 100-i), 'TEST').rsi, 0);
  assert.equal(computeIndicatorsFromRows(bars(80, () => 100), 'TEST').macdOsc, 0);
  assert.equal(base.rsi, null); assert.equal(base.ma5, null); assert.equal(base.macdOsc, null);
  const weeks = aggregateWeekly(bars(8, (i) => 100+i));
  assert.equal(weeks.length, 2); assert.equal(weeks[0].open, 100); assert.equal(weeks[0].close, 103); assert.equal(weeks[0].volume, 400);
});
void test('P0 rules enforce crossing, trend and RSI boundaries while missing indicators never trigger', () => {
  const buy = RULES.find((r) => r.ruleId === 'BUY_001')!;
  const sell = RULES.find((r) => r.ruleId === 'SELL_001')!;
  const context: AlertRuleContext = { symbol: 'TEST', name: 'Asset', heldQuantity: 1, daily: { ...base, ma5: 110, ma20: 100, rsi: 79 }, weekly: { ...base, prevMacdOsc: 0, macdOsc: 1, prevClose: 100, prevMa40: 100, close: 98, ma40: 99 } };
  assert.equal(buy.condition(context), true); assert.equal(buy.condition({ ...context, heldQuantity: 0 }), true);
  assert.equal(buy.condition({ ...context, daily: { ...context.daily!, rsi: 80 } }), false);
  assert.equal(buy.condition({ ...context, daily: { ...context.daily!, ma5: 100 } }), false);
  assert.equal(buy.condition({ ...context, weekly: { ...context.weekly!, macdOsc: 0 } }), false);
  assert.equal(sell.condition(context), true); assert.equal(sell.condition({ ...context, heldQuantity: 0 }), false);
  assert.equal(sell.condition({ ...context, weekly: { ...context.weekly!, close: 99 } }), false);
  for (const rule of RULES) {
    assert.equal(rule.condition({ ...context, daily: null, weekly: null }), false);
    assert.ok(rule.message(context, 'Asset')); assert.ok(rule.action);
  }
});
void test('valuation and public write validation handle zero, missing data, and unsafe return URLs', () => {
  assert.equal(getPositionMarketValue({ currentMarketValue: 0, currentValue: 10, quantity: 2 }), 0);
  assert.equal(getPositionMarketValue({ currentValue: null, quantity: 2 }), null);
  assert.equal(calculateComparison(10, 0), null);
  assert.deepEqual(calculateComparison(90, 100), { amountDiff: -10, percentDiff: -10, isPositive: false });
  for (const path of ['//evil.example', 'https://evil.example', '/login', '/dashboard\n']) assert.equal(normalizeInternalPath(path), '/dashboard');
  assert.equal(normalizeInternalPath('/granaries/new?currency=KRW'), '/granaries/new?currency=KRW');
  assert.equal(validatePublicPositionInput({ isPublic: true }), 'MISSING_PUBLIC_THESIS');
  assert.equal(validatePublicPositionInput({ isPublic: true, publicThesis: 'Reasoning' }), 'MISSING_PUBLIC_METRICS');
  assert.equal(validatePublicPositionInput({ isPublic: true, publicThesis: 'Reasoning', quantity: 0, avgCost: 0, currentValue: 0 }), null);
});
void test('quotes fall back between providers, retain source/as-of, deduplicate lookups, and preserve manual values on failure', async () => {
  const fetch = globalThis.fetch;
  const calls: string[] = [];
  const env = { FSC_STOCK_API_SERVICE_KEY: 'fixture', FSC_STOCK_API_BASE_URL: 'https://fsc.fixture', FSC_SECURITIES_PRODUCT_API_BASE_URL: 'https://fsc.fixture', YAHOO_FINANCE_API_BASE_URL: 'https://yahoo.fixture' } as Env;
  globalThis.fetch = async (input) => {
    const url = String(input); calls.push(url);
    if (url.startsWith('https://fsc.fixture')) return Response.json({ response: { body: { items: { item: [] } } } });
    assert.ok(url.startsWith('https://yahoo.fixture'));
    return Response.json({ chart: { result: [{ meta: { chartPreviousClose: 10 }, timestamp: [1767225600], indicators: { quote: [{ close: [12] }] } }] } });
  };
  try {
    const service = new MarketQuoteService(env);
    const quotes = await loadQuotesForTargets([{ id: 'one', symbol: '005930.KS' }, { id: 'two', symbol: '005930.KS' }], service);
    const quote = quotes.get('one')!;
    assert.equal(quote?.source, 'YAHOO_FINANCE'); assert.equal(quote?.asOfDate, '2026-01-01');
    assert.equal(calls.filter((url) => url.startsWith('https://yahoo.fixture')).length, 1);
    const position = { id: 'one', symbol: '005930.KS', quantity: 2, currentValue: 10 } as Position;
    assert.equal(enrichPositionWithQuote(position, quote).currentMarketValue, 24);
    globalThis.fetch = async () => { throw new Error('fixture unavailable'); };
    const fallback = await enrichPositionsWithLiveQuotes([position], env);
    assert.equal(fallback[0].currentMarketValue, 20); assert.equal(fallback[0].currentPriceSource, 'MANUAL');
  } finally { globalThis.fetch = fetch; }
});
