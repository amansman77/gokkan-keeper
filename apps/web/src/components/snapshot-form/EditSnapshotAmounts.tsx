import type { Dispatch, SetStateAction } from 'react';
import type { UpdateSnapshot } from '../../lib/types';
import { SnapshotAmountField } from './SnapshotFields';
interface EditSnapshotAmountsProps {
  formData: UpdateSnapshot;
  setFormData: Dispatch<SetStateAction<UpdateSnapshot>>;
}

export function EditSnapshotAmounts({ formData, setFormData }: EditSnapshotAmountsProps) {
  return (
    <>
      <SnapshotAmountField id="totalAmount" label="총 평가 금액" required nonnegative value={formData.totalAmount || ''} onChange={value => setFormData({ ...formData, totalAmount: parseFloat(value) || 0 })} />
      <SnapshotAmountField id="availableBalance" label="예수금 (선택)" nonnegative value={formData.availableBalance} onChange={value => setFormData({ ...formData, availableBalance: value ? parseFloat(value) : undefined })}>
        <button type="button" onClick={() => setFormData({ ...formData, availableBalance: null })} className="mt-2 text-sm text-ink-muted hover:text-ink">예수금 제거</button>
      </SnapshotAmountField>
      <SnapshotAmountField id="profitLoss" label="평가 손익 (선택)" value={formData.profitLoss} onChange={value => setFormData({ ...formData, profitLoss: value ? parseFloat(value) : undefined })}>
        <button type="button" onClick={() => setFormData({ ...formData, profitLoss: null })} className="mt-2 text-sm text-ink-muted hover:text-ink">평가 손익 제거</button>
      </SnapshotAmountField>
    </>);
}
