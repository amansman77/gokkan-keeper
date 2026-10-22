import {
  formatPublicPositionValidationError,
  validatePublicPositionInput
} from '@gokkan-keeper/shared';
import { useState } from 'react';
import type { CreatePosition, Granary } from '../lib/types';
import { PositionHoldingsFields } from './position-form/PositionHoldingsFields';
import { PositionIdentityFields } from './position-form/PositionIdentityFields';
import { PositionMarketFields } from './position-form/PositionMarketFields';
import { PositionPublicSection } from './position-form/PositionPublicSection';
import { usePositionQuote } from './position-form/usePositionQuote';

interface PositionFormProps {
  granaries: Granary[];
  initialData: CreatePosition;
  loading: boolean;
  error: string | null;
  submitLabel: string;
  enableQuoteAutoFill?: boolean;
  onSubmit: (data: CreatePosition) => Promise<void>;
  onCancel: () => void;
}

export default function PositionForm({
  granaries,
  initialData,
  loading,
  error,
  submitLabel,
  enableQuoteAutoFill = false,
  onSubmit,
  onCancel,
}: PositionFormProps) {
  const [formData, setFormData] = useState<CreatePosition>(initialData);
  const [clientError, setClientError] = useState<string | null>(null);
  const [showManualCurrentValue, setShowManualCurrentValue] = useState(
    initialData.currentValue !== null && initialData.currentValue !== undefined
  );
  const { canAutoPrice, quoteLoading, quoteMessage } = usePositionQuote(formData, setFormData, enableQuoteAutoFill);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePublicPositionInput({
      ...formData,
      supportsAutomaticPrice: enableQuoteAutoFill && canAutoPrice,
    });
    if (validationError) {
      setClientError(formatPublicPositionValidationError(validationError, 'ko'));
      return;
    }
    setClientError(null);
    await onSubmit(formData);
  };


  return (
    <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
      <PositionIdentityFields formData={formData} setFormData={setFormData} granaries={granaries} quoteLoading={quoteLoading} quoteMessage={quoteMessage} />

      <PositionMarketFields formData={formData} setFormData={setFormData} />

      <PositionHoldingsFields formData={formData} setFormData={setFormData} canAutoPrice={canAutoPrice} showManualCurrentValue={showManualCurrentValue} setShowManualCurrentValue={setShowManualCurrentValue} />

      <PositionPublicSection formData={formData} setFormData={setFormData} />

      <div>
        <label htmlFor="note" className="gk-label">메모(비공개)</label>
        <textarea
          id="note"
          rows={3}
          value={formData.note || ''}
          onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
          className="gk-input"
        />
      </div>

      {(clientError || error) && (
        <div className="gk-alert">
          <p className="gk-error-text">{clientError || error}</p>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="gk-btn gk-btn-secondary flex-1"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="gk-btn gk-btn-primary flex-1"
        >
          {loading ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
