/** Canonical Korean UI labels. Domain semantics live in docs/DOMAIN_GLOSSARY.md. */
export const UI_TERMS = {
  brandName: '곶간 지기',
  publicPortfolio: '공개 포트폴리오',
  positionQuantity: '보유 수량',
  positionAverageCost: '평균 취득가',
  positionUnitPrice: '현재 단가',
  positionMarketValue: '총 평가금액',
} as const;

/** Mirrors currentValue's legacy rule, including a known quantity of zero. */
export function getManualPositionValueLabel(quantity: number | null | undefined): string {
  return quantity != null ? UI_TERMS.positionUnitPrice : UI_TERMS.positionMarketValue;
}
