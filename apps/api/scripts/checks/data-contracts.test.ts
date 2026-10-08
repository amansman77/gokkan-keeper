import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CalendarDateSchema, toMinorUnits, CreatePositionSchema, UpdatePositionSchema } from '@gokkan-keeper/shared';

void test('Gregorian dates distinguish century leap years and money rejects fractional minor units and overflow', () => {
  for (const date of ['2000-02-29', '2024-02-29', '2026-12-31']) assert.ok(CalendarDateSchema.safeParse(date).success);
  for (const date of ['1900-02-29', '2100-02-29', '2026-04-31', '2026-01-00', '2026-1-01']) assert.ok(!CalendarDateSchema.safeParse(date).success);
  assert.equal(toMinorUnits(1.23, 'USD'), 123); assert.equal(toMinorUnits(0.29, 'EUR'), 29);
  assert.equal(toMinorUnits(1000, 'KRW'), 1000); assert.equal(toMinorUnits(5, 'JPY'), 5);
  for (const amount of [0, -1, Infinity, NaN, 0.001, 1.000000001, Number.MAX_SAFE_INTEGER]) assert.throws(() => toMinorUnits(amount, 'USD'));
  assert.throws(() => toMinorUnits(1.5, 'KRW'));
});
void test('sync identities are paired on creation and cannot be changed through patch inputs', () => {
  const position = { name: 'Fixture', symbol: 'TEST' };
  assert.ok(CreatePositionSchema.safeParse(position).success);
  assert.ok(!CreatePositionSchema.safeParse({ ...position, source: 'fixture' }).success);
  assert.ok(CreatePositionSchema.safeParse({ ...position, source: 'fixture', sourceRecordId: 'account:lot' }).success);
  assert.deepEqual(UpdatePositionSchema.parse({ source: 'replace', sourceRecordId: 'replace', quantity: 2 }), { quantity: 2 });
});
