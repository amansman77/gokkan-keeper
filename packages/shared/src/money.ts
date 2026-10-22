import type { CURRENCIES } from './constants';
type Currency = typeof CURRENCIES[number];

/** Exact ledger storage, bounded to the interoperable JS integer range. Never silently round money. */
export function toMinorUnits(amount: number, currency: Currency): number {
  const invalid = () => new RangeError('금액이 통화의 최소 단위 또는 안전한 정수 범위를 벗어납니다.');
  if (!Number.isFinite(amount) || amount <= 0) throw invalid();
  // Use the canonical decimal spelling instead of multiplying binary floats.
  const [coefficient, exponent = '0'] = amount.toString().split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const digits = BigInt(whole + fraction);
  const scale = (currency === 'KRW' || currency === 'JPY' ? 0 : 2) + Number(exponent) - fraction.length;
  const divisor = scale < 0 ? 10n ** BigInt(-scale) : 1n;
  if (digits % divisor !== 0n) throw invalid();
  const minor = scale < 0 ? digits / divisor : digits * 10n ** BigInt(scale);
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) throw invalid();
  return Number(minor);
}
