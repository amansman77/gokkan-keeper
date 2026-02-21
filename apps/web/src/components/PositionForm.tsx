import { useState } from 'react';
import type { CreatePosition, Granary } from '../lib/types';
import { POSITION_ASSET_TYPES, POSITION_MARKETS } from '@gokkan-keeper/shared';

interface PositionFormProps {
  granaries: Granary[];
  initialData: CreatePosition;
  loading: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (data: CreatePosition) => Promise<void>;
  onCancel: () => void;
}

export default function PositionForm({
  granaries,
  initialData,
  loading,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: PositionFormProps) {
  const [formData, setFormData] = useState<CreatePosition>(initialData);
  const [clientError, setClientError] = useState<string | null>(null);
  const hasCustomMarket = !!formData.market && !POSITION_MARKETS.includes(formData.market as any);
  const hasCustomAssetType = !!formData.assetType && !POSITION_ASSET_TYPES.includes(formData.assetType as any);

  const validatePublicFields = (data: CreatePosition) => {
    if (!data.isPublic) return null;
    if (!data.publicThesis || !data.publicThesis.trim()) {
      return '공개 포지션은 공개 한 줄 가설이 필요합니다.';
    }

    const hasCurrentValue = data.currentValue !== null && data.currentValue !== undefined;
    const hasWeightPercent = data.weightPercent !== null && data.weightPercent !== undefined;
    const hasCostBasis =
      data.quantity !== null &&
      data.quantity !== undefined &&
      data.avgCost !== null &&
      data.avgCost !== undefined;

    if (!hasCurrentValue && !hasCostBasis && !hasWeightPercent) {
      return '공개 포지션은 비중, 현재가치 또는 (수량 + 평균단가)가 필요합니다.';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePublicFields(formData);
    if (validationError) {
      setClientError(validationError);
      return;
    }
    setClientError(null);
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <label htmlFor="granaryId" className="block text-sm font-medium text-gray-700 mb-2">곳간(선택)</label>
        <select
          id="granaryId"
          value={formData.granaryId || ''}
          onChange={(e) => setFormData({ ...formData, granaryId: e.target.value || null })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">미분류</option>
          {granaries.map((granary) => (
            <option key={granary.id} value={granary.id}>
              {granary.name} ({granary.purpose})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">종목명</label>
          <input
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-2">심볼</label>
          <input
            id="symbol"
            required
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="AAPL"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="market" className="block text-sm font-medium text-gray-700 mb-2">시장(선택)</label>
          <select
            id="market"
            value={formData.market || ''}
            onChange={(e) => setFormData({ ...formData, market: e.target.value || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">선택 안 함</option>
            {POSITION_MARKETS.map((market) => (
              <option key={market} value={market}>
                {market}
              </option>
            ))}
            {hasCustomMarket && <option value={formData.market || ''}>{formData.market}</option>}
          </select>
        </div>
        <div>
          <label htmlFor="assetType" className="block text-sm font-medium text-gray-700 mb-2">자산유형(선택)</label>
          <select
            id="assetType"
            value={formData.assetType || ''}
            onChange={(e) => setFormData({ ...formData, assetType: e.target.value || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">선택 안 함</option>
            {POSITION_ASSET_TYPES.map((assetType) => (
              <option key={assetType} value={assetType}>
                {assetType}
              </option>
            ))}
            {hasCustomAssetType && <option value={formData.assetType || ''}>{formData.assetType}</option>}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">수량(선택)</label>
          <input
            id="quantity"
            type="number"
            step="0.0001"
            value={formData.quantity ?? ''}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="avgCost" className="block text-sm font-medium text-gray-700 mb-2">평균단가(선택)</label>
          <input
            id="avgCost"
            type="number"
            step="0.0001"
            value={formData.avgCost ?? ''}
            onChange={(e) => setFormData({ ...formData, avgCost: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="currentValue" className="block text-sm font-medium text-gray-700 mb-2">현재가치(선택)</label>
          <input
            id="currentValue"
            type="number"
            step="0.01"
            value={formData.currentValue ?? ''}
            onChange={(e) => setFormData({ ...formData, currentValue: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            onChange={(e) => setFormData({ ...formData, weightPercent: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">공개 포트폴리오 표시</label>
          <input
            id="isPublic"
            type="checkbox"
            checked={!!formData.isPublic}
            onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
        </div>

        <div>
          <label htmlFor="publicThesis" className="block text-sm font-medium text-gray-700 mb-2">공개 한 줄 가설</label>
          <input
            id="publicThesis"
            value={formData.publicThesis || ''}
            onChange={(e) => setFormData({ ...formData, publicThesis: e.target.value || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={300}
          />
        </div>

        <div>
          <label htmlFor="publicOrder" className="block text-sm font-medium text-gray-700 mb-2">공개 정렬 순서</label>
          <input
            id="publicOrder"
            type="number"
            min={0}
            value={formData.publicOrder ?? 0}
            onChange={(e) => setFormData({ ...formData, publicOrder: parseInt(e.target.value || '0', 10) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">메모(비공개)</label>
        <textarea
          id="note"
          rows={3}
          value={formData.note || ''}
          onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {(clientError || error) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{clientError || error}</p>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
