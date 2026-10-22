import type { Dispatch, SetStateAction } from 'react';
import { UI_TERMS } from '../../lib/terminology';
import type { CreatePosition } from '../../lib/types';
import { PositionPricingSection } from './PositionPricingSection';
interface FieldProps { formData: CreatePosition; setFormData: Dispatch<SetStateAction<CreatePosition>>; }
function parseNullableNumber(value: string): number | null {
  return value ? Number.parseFloat(value) : null;
}

export function PositionHoldingsFields({ formData, setFormData, canAutoPrice, showManualCurrentValue, setShowManualCurrentValue }: FieldProps & { canAutoPrice: boolean; showManualCurrentValue: boolean; setShowManualCurrentValue: Dispatch<SetStateAction<boolean>> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label htmlFor="quantity" className="gk-label">{UI_TERMS.positionQuantity}(선택)</label>
        <input
          id="quantity"
          type="number"
          step="0.0001"
          value={formData.quantity ?? ''}
          onChange={(e) => setFormData({ ...formData, quantity: parseNullableNumber(e.target.value) })}
          className="gk-input"
        />
      </div>
      <div>
        <label htmlFor="avgCost" className="gk-label">{UI_TERMS.positionAverageCost}(선택)</label>
        <input
          id="avgCost"
          type="number"
          step="0.0001"
          value={formData.avgCost ?? ''}
          onChange={(e) => setFormData({ ...formData, avgCost: parseNullableNumber(e.target.value) })}
          className="gk-input"
        />
      </div>
      <PositionPricingSection
        formData={formData}
        canAutoPrice={canAutoPrice}
        showManualCurrentValue={showManualCurrentValue}
        setShowManualCurrentValue={setShowManualCurrentValue}
        setFormData={setFormData}
      />
    </div>
  );
}
