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
    <div className="rounded-md border border-line-soft p-4 space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="isPublic" className="text-sm font-medium text-ink-muted">공개 포트폴리오 표시</label>
        <input
          id="isPublic"
          type="checkbox"
          checked={!!formData.isPublic}
          onChange={(e) => setFormData((prev) => ({ ...prev, isPublic: e.target.checked }))}
          className="h-4 w-4 text-accent border-line rounded"
        />
      </div>

      <div>
        <label htmlFor="publicThesis" className="gk-label">공개 한 줄 가설</label>
        <input
          id="publicThesis"
          value={formData.publicThesis || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, publicThesis: e.target.value || null }))}
          className="gk-input"
          maxLength={300}
        />
      </div>

      <div>
        <label htmlFor="publicOrder" className="gk-label">공개 정렬 순서</label>
        <input
          id="publicOrder"
          type="number"
          min={0}
          value={formData.publicOrder ?? 0}
          onChange={(e) => setFormData((prev) => ({ ...prev, publicOrder: Number.parseInt(e.target.value || '0', 10) }))}
          className="gk-input"
        />
      </div>
    </div>
  );
}
