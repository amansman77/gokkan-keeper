import type { Dispatch, SetStateAction } from 'react';
import type { CreatePosition } from '../../lib/types';

interface PositionPublicSectionProps {
  formData: CreatePosition;
  setFormData: Dispatch<SetStateAction<CreatePosition>>;
}

export function PositionPublicSection({
  formData,
  setFormData,
}: PositionPublicSectionProps) {
  return (
    <div className="rounded-md border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">공개 포트폴리오 표시</label>
        <input
          id="isPublic"
          type="checkbox"
          checked={!!formData.isPublic}
          onChange={(e) => setFormData((prev) => ({ ...prev, isPublic: e.target.checked }))}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
        />
      </div>

      <div>
        <label htmlFor="publicThesis" className="block text-sm font-medium text-gray-700 mb-2">공개 한 줄 가설</label>
        <input
          id="publicThesis"
          value={formData.publicThesis || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, publicThesis: e.target.value || null }))}
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
          onChange={(e) => setFormData((prev) => ({ ...prev, publicOrder: Number.parseInt(e.target.value || '0', 10) }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
