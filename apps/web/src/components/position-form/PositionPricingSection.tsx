import type { Dispatch, SetStateAction } from 'react';
import type { CreatePosition } from '../../lib/types';

interface PositionPricingSectionProps {
  formData: CreatePosition;
  canAutoPrice: boolean;
  showManualCurrentValue: boolean;
  setShowManualCurrentValue: Dispatch<SetStateAction<boolean>>;
  setFormData: Dispatch<SetStateAction<CreatePosition>>;
}

function parseNullableNumber(value: string): number | null {
  return value ? Number.parseFloat(value) : null;
}

export function PositionPricingSection({
  formData,
  canAutoPrice,
  showManualCurrentValue,
  setShowManualCurrentValue,
  setFormData,
}: PositionPricingSectionProps) {
  return (
    <>
      <div className="md:col-span-3">
        {canAutoPrice ? (
          <div className="rounded-md border border-line-soft bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">현재가 자동 연동</p>
                <p className="mt-1 text-xs text-ink-muted">
                  이 포지션은 저장 후 금융위원회 또는 Yahoo Finance 시세 기준 현재가와 평가금액을 자동으로 계산합니다.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={showManualCurrentValue}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowManualCurrentValue(checked);
                    if (!checked) {
                      setFormData((prev) => ({ ...prev, currentValue: null }));
                    }
                  }}
                  className="h-4 w-4 text-accent border-line rounded"
                />
                수동 대체값 입력
              </label>
            </div>
            {showManualCurrentValue && (
              <div className="mt-4">
                <label htmlFor="currentValue" className="block text-sm font-medium text-ink-muted mb-2">현재 단가/평가금액 (수동 대체값)</label>
                <input
                  id="currentValue"
                  type="number"
                  step="0.01"
                  value={formData.currentValue ?? ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currentValue: parseNullableNumber(e.target.value) }))}
                  className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="currentValue" className="block text-sm font-medium text-ink-muted mb-2">현재 단가/평가금액 (수동 입력)</label>
            <input
              id="currentValue"
              type="number"
              step="0.01"
              value={formData.currentValue ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, currentValue: parseNullableNumber(e.target.value) }))}
              className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-ink-faint">수량이 있으면 단가, 없으면 총 평가금액으로 사용합니다.</p>
          </div>
        )}
      </div>
    </>
  );
}
