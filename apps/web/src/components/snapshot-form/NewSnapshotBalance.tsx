import { SnapshotAmountField } from './SnapshotFields';
import type { NewSnapshotState } from './useNewSnapshot';
interface NewSnapshotBalanceProps {
  state: NewSnapshotState;
}

export function NewSnapshotBalance({ state }: NewSnapshotBalanceProps) {
  const { formData, setFormData } = state;
  return (
    <SnapshotAmountField id="availableBalance" label="예수금 (선택)" value={formData.availableBalance} nonnegative
      onChange={(value) => setFormData({ ...formData, availableBalance: value ? parseFloat(value) : undefined })}>

    </SnapshotAmountField>
  );
}
