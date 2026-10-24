import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ImportJob, Position, Snapshot } from '@gokkan-keeper/shared';
import { readKrw, readPercent, readUsd } from '../../src/services/screenshot-import/numbers';
import { mergePages } from '../../src/services/screenshot-import/merge';
import { reconcile, type ReconcileInput } from '../../src/services/screenshot-import/reconcile';
import { applyResult, ImportNotApplicable } from '../../src/services/screenshot-import';
import { authenticateAutomation, permitsAutomation } from '../../src/auth/automation';
import type { Env } from '../../src/types';
import type { ImportRepository } from '../../src/db/repositories/import-repository';
import { krCashPage, krHoldingsPage, usCashPage, usHoldingsPage, type FixtureRow } from './screenshot-fixtures';

const ACCOUNT = '0000001234-01';
const position = (p: Partial<Position> & Pick<Position, 'id' | 'name' | 'symbol'>): Position =>
  ({ granaryId: 'g', isPublic: false, publicOrder: 0, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...p }) as Position;
const input = (reading: ReconcileInput['reading'], extra: Partial<ReconcileInput> = {}): ReconcileInput => ({
  reading, positions: [], otherPositions: [], lastSnapshot: null, flowsSinceLastSnapshot: [], linkedAccountSuffix: null, date: '2026-10-24', ...extra,
});

void test('OCR number readers repair only the misreads real screenshots showed', () => {
  assert.deepEqual(readKrw('-287.463원'), { value: -287463, repaired: true });
  assert.deepEqual(readKrw('15,1551'), { value: 15155, repaired: true });
  assert.deepEqual(readKrw('1,312,112원'), { value: 1312112, repaired: false });
  assert.equal(readKrw('12a'), null);
  assert.deepEqual(readUsd('347.72501'), { value: 347.725, repaired: true });
  assert.deepEqual(readUsd('-120.58uso'), { value: -120.58, repaired: false });
  assert.deepEqual(readUsd('4,625.47USD'), { value: 4625.47, repaired: false });
  assert.equal(readPercent('-5.97%'), -5.97);
  assert.equal(readPercent('-597%'), null);
});

const KR_A: FixtureRow[] = [
  { name: '대한전선', quantity: 9, marketValue: '189,900', profitLoss: '-53,514', percent: '-21.98%' },
  { name: 'NHN브', quantity: 20, marketValue: '49,100', profitLoss: '-179,529', percent: '-78.52%' },
  { name: '파두', quantity: 1, marketValue: '47,000', profitLoss: '36,540', percent: '349.33%' },
];
const KR_B: FixtureRow[] = [
  KR_A[2], // overlaps the first screenshot
  { name: 'KODEX ?IENifty50', quantity: 12, marketValue: '125,9401', profitLoss: '-29,820', percent: '-19.14%' },
];

void test('domestic pages are merged by row numbers, checked against the header total and matched despite garbled names', () => {
  const pages = [krHoldingsPage(1, ACCOUNT, '-226.323원 -9.9%', KR_A), krHoldingsPage(2, ACCOUNT, '-226.323원 -9.9%', KR_B, true), krCashPage(3, ACCOUNT, '1,312,112')];
  const reading = mergePages(pages, 'KRW');
  assert.equal(reading.holdings.length, 4);
  assert.deepEqual(reading.checks.map((c) => [c.code, c.passed]), [['profit_loss_total', true], ['cash_present', true]]);
  assert.ok(reading.warnings.some((w) => w.code === 'repaired_number'));
  const positions = [
    position({ id: 'p1', name: '대한전선', symbol: '001440', quantity: 9, avgCost: 27046 }),
    position({ id: 'p2', name: 'NHN벅스', symbol: '104200', quantity: 20, avgCost: 11431 }),
    position({ id: 'p3', name: '파두', symbol: '440110', quantity: 1, avgCost: 10460 }),
    position({ id: 'p4', name: 'KODEX 인도Nifty50', symbol: '453810', quantity: 10, avgCost: 12980 }),
    position({ id: 'p5', name: 'SK하이닉스', symbol: '000660', quantity: 3, avgCost: 250000 }),
  ];
  const result = reconcile(input(reading, { positions }));
  assert.deepEqual(result.proposal?.changes.map((c) => [c.positionId, c.after.quantity, c.after.avgCost]), [['p4', 12, 12980]]);
  assert.equal(result.proposal?.unchanged, 3);
  assert.deepEqual(result.proposal?.missingPositions.map((m) => m.positionId), ['p5']);
  assert.deepEqual(result.proposal?.snapshot, { date: '2026-10-24', marketValue: 411940, availableBalance: 1312112, totalAmount: 1724052, profitLoss: -226323 });
});

void test('a missing screenshot fails the total check and the result cannot be applied', async () => {
  const reading = mergePages([krHoldingsPage(1, ACCOUNT, '-226.323원 -9.9%', KR_A), krCashPage(2, ACCOUNT, '9,951')], 'KRW');
  const result = reconcile(input(reading));
  assert.equal(result.checks.find((c) => c.code === 'profit_loss_total')?.passed, false);
  const job = { id: 'j', granaryId: 'g', status: 'parsed', result } as ImportJob;
  await assert.rejects(applyResult({} as ImportRepository, job, {}), ImportNotApplicable);
});

const US_ROWS: FixtureRow[] = [
  { name: '이튼', ticker: 'ETN', quantity: 2, marketValue: '732.2200', profitLoss: '-153.0600', percent: '-17.28%' },
  { name: 'Vanguard High Dividend Yield ETF', ticker: 'VYM', quantity: null, marketValue: '161.5000', profitLoss: '15.5000', percent: '10.61%' },
  { name: '애플', ticker: 'AAPL', quantity: 1, marketValue: '347.72501', profitLoss: '138.8350', percent: '66.46%' },
];

void test('overseas rows match by ticker, recover a dropped quantity from cost basis, and prefer the same-quantity duplicate', () => {
  const pages = [usHoldingsPage(1, ACCOUNT, { profitLoss: '1.27uso', marketValue: '1,241.44USD' }, US_ROWS), usCashPage(2, ACCOUNT, '212.64')];
  const reading = mergePages(pages, 'USD');
  assert.ok(reading.checks.every((c) => c.passed), JSON.stringify(reading.checks));
  const positions = [
    position({ id: 'etn', name: 'Eaton', symbol: 'ETN', quantity: 1, avgCost: 449.37 }),
    position({ id: 'vym', name: 'VYM', symbol: 'VYM', quantity: 1, avgCost: 146 }),
    position({ id: 'aapl-old', name: 'Apple', symbol: 'AAPL', quantity: 0, avgCost: 200 }),
    position({ id: 'aapl', name: 'Apple', symbol: 'AAPL', quantity: 1, avgCost: 208.89 }),
  ];
  const result = reconcile(input(reading, { positions }));
  assert.deepEqual(result.proposal?.changes.map((c) => [c.positionId, c.after]), [['etn', { quantity: 2, avgCost: 442.64 }]]);
  assert.equal(result.holdings.find((h) => h.ticker === 'VYM')?.quantity, 1);
  assert.equal(result.proposal?.unchanged, 2);
  assert.equal(result.proposal?.snapshot.totalAmount, 1454.08);
});

void test('a quantity that cannot be read or recovered blocks the import', () => {
  const rows: FixtureRow[] = [{ name: '대한전선', quantity: null, marketValue: '189,900', profitLoss: '-53,514', percent: '-21.98%' }];
  const result = reconcile(input(mergePages([krHoldingsPage(1, ACCOUNT, '-53.514원', rows), krCashPage(2, ACCOUNT, '1')], 'KRW')));
  assert.equal(result.checks.find((c) => c.code === 'quantities')?.passed, false);
  const usd = mergePages([usHoldingsPage(1, ACCOUNT, { profitLoss: '1.27uso', marketValue: '' }, US_ROWS.slice(0, 1)), usCashPage(2, ACCOUNT, '1')], 'USD');
  assert.equal(usd.checks.find((c) => c.code === 'market_value_total')?.passed, false);
});

void test('account and currency guards: mixed, mismatched or foreign-currency screens are flagged', () => {
  const mixed = mergePages([krHoldingsPage(1, ACCOUNT, '-226.323원', KR_A), krCashPage(2, '0000009999-01', '1')], 'KRW');
  assert.equal(reconcile(input(mixed)).checks.find((c) => c.code === 'account')?.passed, false);
  const single = mergePages([krCashPage(1, ACCOUNT, '1')], 'KRW');
  assert.equal(reconcile(input(single, { linkedAccountSuffix: '9999' })).checks.find((c) => c.code === 'account')?.passed, false);
  assert.equal(reconcile(input(single, { linkedAccountSuffix: '1234' })).checks.find((c) => c.code === 'account')?.passed, true);
  const foreign = mergePages([usCashPage(1, ACCOUNT, '212.64'), krCashPage(2, ACCOUNT, '1')], 'KRW');
  assert.ok(foreign.warnings.some((w) => w.code === 'ignored_pages'));
});

void test('cash moved by unrecorded transfers is reported; recorded flows explain it', () => {
  const reading = mergePages([krCashPage(1, ACCOUNT, '1,312,112')], 'KRW');
  const lastSnapshot = { id: 's', granaryId: 'g', date: '2026-09-27', totalAmount: 7366333, availableBalance: 2479603 } as Snapshot;
  const unexplained = reconcile(input(reading, { lastSnapshot }));
  assert.ok(unexplained.warnings.some((w) => w.code === 'unexplained_cash' && w.detail.includes('1,167,491원')));
  const flows = [602984, 420288, 144219].map((amount, i) => ({ id: String(i), granaryId: 'g', date: '2026-10-13', type: 'WITHDRAWAL', amount }) as never);
  assert.ok(!reconcile(input(reading, { lastSnapshot, flowsSinceLastSnapshot: flows })).warnings.some((w) => w.code === 'unexplained_cash'));
});

void test('only the imports:process scope reaches the OCR worker routes, and never owner routes', () => {
  const worker = { scopes: ['imports:process' as const] };
  const id = '00000000-0000-4000-8000-000000000000';
  assert.equal(permitsAutomation(worker, '/imports/next', 'GET'), true);
  assert.equal(permitsAutomation(worker, `/imports/${id}/images/3`, 'GET'), true);
  assert.equal(permitsAutomation(worker, `/imports/${id}/ocr`, 'POST'), true);
  assert.equal(permitsAutomation(worker, `/imports/${id}/fail`, 'POST'), true);
  for (const [path, method] of [['/imports', 'POST'], [`/imports/${id}`, 'GET'], [`/imports/${id}/apply`, 'POST'], [`/imports/${id}/images/1`, 'PUT'], ['/positions', 'POST']]) {
    assert.equal(permitsAutomation(worker, path, method), false, `${method} ${path}`);
  }
  assert.equal(permitsAutomation({ scopes: ['snapshots:sync'] }, '/imports/next', 'GET'), false);
});

void test('the shared legacy API secret never carries the screenshot scope', async () => {
  const legacy = await authenticateAutomation('fixture-legacy-secret-for-scope-check', { API_SECRET: 'fixture-legacy-secret-for-scope-check' } as Env);
  assert.ok(legacy);
  assert.equal(permitsAutomation(legacy, '/imports/next', 'GET'), false);
  assert.equal(permitsAutomation(legacy, '/snapshots', 'POST'), true);
});
