import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CashFlow, Snapshot } from '@gokkan-keeper/shared';
import { snapshotPerformance } from '../../../web/src/components/granary-detail/valuation';
import { fromDraft, toDraft, totalInKrw } from '../../../web/src/components/asset-goal/model';
import { parseAssetGoalPlan } from '@gokkan-keeper/shared';
import { isValidImage } from '../../src/services/image-validation';
const snapshot = (date: string, totalAmount: number) => ({ date, totalAmount }) as Snapshot;
const flow = (date: string, amount: number, type: CashFlow['type'] = 'DEPOSIT') => ({ date, amount, type }) as CashFlow;
void test('granary performance excludes previous-day flows and includes latest-day flows', () => {
  const result = snapshotPerformance(snapshot('2026-02-02', 130), snapshot('2026-02-01', 100), [
    flow('2026-02-01', 1000), flow('2026-02-02', 40), flow('2026-02-02', 20, 'WITHDRAWAL'), flow('2026-02-03', 1000),
  ]);
  assert.equal(result.rawDelta, 30);
  assert.equal(result.netCashFlowSincePrevious, 20);
  assert.equal(result.performanceDelta, 10);
  assert.equal(result.performancePct, 10 / 120 * 100);
  assert.equal(result.hasCashFlowInPeriod, true);
  assert.equal(snapshotPerformance(snapshot('2026-02-02', 10), undefined, []).performanceDelta, null);
  assert.equal(snapshotPerformance(snapshot('2026-02-02', 10), snapshot('2026-02-01', 0), []).performancePct, null);
  assert.equal(snapshotPerformance(snapshot('2026-02-02', 100), snapshot('2026-02-01', 100), [flow('2026-02-02', 10), flow('2026-02-02', 10, 'WITHDRAWAL')]).hasCashFlowInPeriod, false);
});
void test('goal draft round trip retains baseline and optional target return; currency exclusions remain explicit', () => {
  const plan = parseAssetGoalPlan(undefined);
  const draft = toDraft({ ...plan, baseline: { date: '2026-01-01', amount: 100000 } });
  draft.targetReturnPct = '';
  const parsed = fromDraft(draft, { date: '2026-01-01', amount: 100000 });
  assert.ok(parsed.success);
  assert.equal(parsed.data.targetAnnualReturn, undefined);
  assert.equal(parsed.data.baseline?.amount, 100000);
  const granaries = [
    { name: 'KRW', currency: 'KRW', latestSnapshot: snapshot('2026-01-01', 100) },
    { name: 'USD', currency: 'USD', latestSnapshot: snapshot('2026-01-01', 10) },
    { name: 'JPY', currency: 'JPY', latestSnapshot: snapshot('2026-01-01', 10) },
  ] as Parameters<typeof totalInKrw>[0];
  assert.deepEqual(totalInKrw(granaries, 1400), { total: 14100, excluded: ['JPY'] });
  assert.deepEqual(totalInKrw(granaries, null), { total: 100, excluded: ['USD', 'JPY'] });
});
function jpeg() {
  // Minimal bounded container accepted by the structural validator, not a full decoder.
  return Uint8Array.from([255, 216, 255, 192, 0, 8, 8, 0, 1, 0, 1, 1, 255, 218, 0, 2, 1, 2, 3, 4, 255, 217]);
}
function webp(lossless: boolean) {
  const bytes = new Uint8Array(lossless ? 26 : 30);
  const view = new DataView(bytes.buffer);
  bytes.set(Buffer.from('RIFF'), 0); view.setUint32(4, bytes.length - 8, true);
  bytes.set(Buffer.from('WEBP'), 8); bytes.set(Buffer.from(lossless ? 'VP8L' : 'VP8 '), 12);
  view.setUint32(16, lossless ? 5 : 10, true);
  if (lossless) bytes[20] = 0x2f;
  else { bytes.set([0x9d, 1, 0x2a], 23); view.setUint16(26, 1, true); view.setUint16(28, 1, true); }
  return bytes;
}
void test('JPEG parser rejects absent frames, invalid dimensions, truncated segments and MIME mismatch', () => {
  const bytes = jpeg();
  assert.equal(isValidImage(bytes, 'image/jpeg'), true);
  const noFrame = bytes.slice(); noFrame[3] = 0xe0;
  const zeroHeight = bytes.slice(); zeroHeight[8] = 0;
  const oversized = bytes.slice(); oversized[9] = 255;
  const segmentOverflow = bytes.slice(); segmentOverflow[5] = 255;
  for (const invalid of [noFrame, zeroHeight, oversized, segmentOverflow, bytes.subarray(0, 17)]) assert.equal(isValidImage(invalid, 'image/jpeg'), false);
  assert.equal(isValidImage(bytes, 'image/png'), false);
});
void test('WebP parser bounds lossy/lossless chunks and rejects animation, bad signatures and overflow', () => {
  for (const lossless of [true, false]) {
    const bytes = webp(lossless);
    assert.equal(isValidImage(bytes, 'image/webp'), true);
    const overflow = bytes.slice(); overflow[16] = 255;
    const wrongRiff = bytes.slice(); wrongRiff[4] = 255;
    const animation = bytes.slice(); animation.set(Buffer.from('ANIM'), 12);
    const signature = bytes.slice(); signature[lossless ? 20 : 23] = 0;
    for (const invalid of [overflow, wrongRiff, animation, signature, bytes.subarray(0, bytes.length - 1)]) assert.equal(isValidImage(invalid, 'image/webp'), false);
  }
});
function pngCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
void test('PNG parser retains CRC, dimension, static-image and trailing-data guards', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
  const zeroWidth = Buffer.from(png); zeroWidth.writeUInt32BE(0, 16);
  zeroWidth.writeUInt32BE(pngCrc(zeroWidth.subarray(12, 29)), 29);
  const huge = Buffer.from(png); huge.writeUInt32BE(10000, 16); huge.writeUInt32BE(10000, 20);
  huge.writeUInt32BE(pngCrc(huge.subarray(12, 29)), 29);
  const animatedChunk = Buffer.alloc(12); animatedChunk.write('acTL', 4);
  animatedChunk.writeUInt32BE(pngCrc(animatedChunk.subarray(4, 8)), 8);
  const animated = Buffer.concat([png.subarray(0, 33), animatedChunk, png.subarray(33)]);
  const brokenCrc = Buffer.from(png); brokenCrc[45] ^= 1;
  for (const bytes of [zeroWidth, huge, animated, brokenCrc, Buffer.concat([png, Buffer.from([0])]), png.subarray(0, png.length - 1)]) assert.equal(isValidImage(bytes, 'image/png'), false);
  assert.equal(isValidImage(png, 'image/png'), true);
});
