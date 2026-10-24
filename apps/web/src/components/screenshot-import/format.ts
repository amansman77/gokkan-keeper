export const money = (value: number, currency: 'KRW' | 'USD') =>
  currency === 'KRW' ? `${Math.round(value).toLocaleString('ko-KR')}원` : `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const cost = (value: number | null, currency: 'KRW' | 'USD') =>
  value === null ? '-' : currency === 'KRW' ? `${Math.round(value).toLocaleString('ko-KR')}원` : `$${value.toFixed(4).replace(/0{1,2}$/, '')}`;
