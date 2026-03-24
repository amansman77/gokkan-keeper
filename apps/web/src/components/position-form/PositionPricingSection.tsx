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
      <div className="md:col-span-2">
        {canAutoPrice ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">현재가 자동 연동</p>
                <p className="mt-1 text-xs text-gray-600">
                  이 포지션은 저장 후 금융위원회 또는 Yahoo Finance 시세 기준 현재가와 평가금액을 자동으로 계산합니다.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
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
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                수동 fallback 입력
              </label>
            </div>
            {showManualCurrentValue && (
              <div className="mt-4">
                <label htmlFor="currentValue" className="block text-sm font-medium text-gray-700 mb-2">현재 단가/현재가치(수동 fallback)</label>
                <input
                  id="currentValue"
                  type="number"
                  step="0.01"
                  value={formData.currentValue ?? ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currentValue: parseNullableNumber(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="currentValue" className="block text-sm font-medium text-gray-700 mb-2">현재 단가/현재가치(수동 입력)</label>
            <input
              id="currentValue"
              type="number"
              step="0.01"
              value={formData.currentValue ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, currentValue: parseNullableNumber(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">자동 시세 연동이 없는 자산은 이 값을 기준으로 평가금액이 계산됩니다.</p>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="weightPercent" className="block text-sm font-medium text-gray-700 mb-2">비중 %(선택)</label>
        <input
          id="weightPercent"
          type="number"
          step="0.01"
          min={0}
          max={100}
          value={formData.weightPercent ?? ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, weightPercent: parseNullableNumber(e.target.value) }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </>
  );
}
