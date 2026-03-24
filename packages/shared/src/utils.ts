import type { Position } from './schemas';

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function daysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function normalizeInternalPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return fallback;
  }

  if (/[\r\n]/.test(raw)) {
    return fallback;
  }

  if (raw.startsWith('/login')) {
    return fallback;
  }

  return raw;
}

export interface ComparisonResult {
  amountDiff: number;
  percentDiff: number;
  isPositive: boolean;
}

export type PublicPositionValidationError =
  | 'MISSING_PUBLIC_THESIS'
  | 'MISSING_PUBLIC_METRICS';

export interface PublicPositionValidationInput {
  isPublic?: boolean | null;
  publicThesis?: string | null;
  weightPercent?: number | null;
  quantity?: number | null;
  avgCost?: number | null;
  currentValue?: number | null;
  supportsAutomaticPrice?: boolean | null;
}

type PublicPositionValidationLocale = 'ko' | 'en';

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

export function getPositionMarketValue(
  position: Pick<Position, 'currentMarketValue' | 'currentValue' | 'quantity'>,
): number | null {
  if (hasValue(position.currentMarketValue)) {
    return position.currentMarketValue;
  }

  if (!hasValue(position.currentValue)) {
    return null;
  }

  if (hasValue(position.quantity)) {
    return position.quantity * position.currentValue;
  }

  return position.currentValue;
}

export function calculateComparison(current: number, previous: number): ComparisonResult | null {
  if (previous === 0) {
    return null;
  }
  
  const amountDiff = current - previous;
  const percentDiff = (amountDiff / previous) * 100;
  const isPositive = amountDiff >= 0;
  
  return {
    amountDiff,
    percentDiff,
    isPositive,
  };
}

export function validatePublicPositionInput(
  data: PublicPositionValidationInput,
): PublicPositionValidationError | null {
  if (!data.isPublic) return null;

  if (!data.publicThesis || !data.publicThesis.trim()) {
    return 'MISSING_PUBLIC_THESIS';
  }

  const hasCurrentValue = data.currentValue !== null && data.currentValue !== undefined;
  const hasWeightPercent = data.weightPercent !== null && data.weightPercent !== undefined;
  const hasCostBasis =
    data.quantity !== null &&
    data.quantity !== undefined &&
    data.avgCost !== null &&
    data.avgCost !== undefined;
  const hasAutomaticPrice = !!data.supportsAutomaticPrice;

  if (!hasCurrentValue && !hasWeightPercent && !(hasCostBasis && hasAutomaticPrice)) {
    return 'MISSING_PUBLIC_METRICS';
  }

  return null;
}

export function formatPublicPositionValidationError(
  error: PublicPositionValidationError,
  locale: PublicPositionValidationLocale = 'en',
): string {
  const messages = {
    ko: {
      MISSING_PUBLIC_THESIS: '공개 포지션은 공개 한 줄 가설이 필요합니다.',
      MISSING_PUBLIC_METRICS: '공개 포지션은 비중, 현재가치 또는 자동 시세 연동 가능한 (수량 + 평균단가)가 필요합니다.',
    },
    en: {
      MISSING_PUBLIC_THESIS: 'Public position requires publicThesis.',
      MISSING_PUBLIC_METRICS: 'Public position requires weightPercent, currentValue, or auto-priced (quantity and avgCost).',
    },
  } as const;

  return messages[locale][error];
}
