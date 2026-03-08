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

  if (!hasCurrentValue && !hasCostBasis && !hasWeightPercent) {
    return 'MISSING_PUBLIC_METRICS';
  }

  return null;
}
