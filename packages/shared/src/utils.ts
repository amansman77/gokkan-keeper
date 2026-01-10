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

export interface ComparisonResult {
  amountDiff: number;
  percentDiff: number;
  isPositive: boolean;
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
