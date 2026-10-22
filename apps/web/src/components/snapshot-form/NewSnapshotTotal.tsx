import { SnapshotAmountField } from './SnapshotFields';
import type { NewSnapshotState } from './useNewSnapshot';
interface NewSnapshotTotalProps {
  state: NewSnapshotState;
}

export function NewSnapshotTotal({ state }: NewSnapshotTotalProps) {
  const { formData, setFormData, isTotalAmountManual, setIsTotalAmountManual, setIsProfitLossManual } = state;
  return (
    <SnapshotAmountField id="totalAmount" label="총 평가 금액" value={formData.totalAmount} required nonnegative
      onChange={(value) => {
        setIsTotalAmountManual(true);
        setIsProfitLossManual(false);
        setFormData({ ...formData, totalAmount: parseFloat(value) || 0 });
      }}
      hint={<>
        {!isTotalAmountManual && formData.availableBalance !== undefined && formData.profitLoss !== undefined && (
          <span className="ml-2 text-xs text-ink-faint">(자동 계산됨)</span>
        )}
      </>}>

      {isTotalAmountManual && (
        <button
          type="button"
          onClick={() => {
            setIsTotalAmountManual(false);
            if (formData.availableBalance !== undefined && formData.profitLoss !== undefined) {
              const calculatedTotal = (formData.availableBalance || 0) + (formData.profitLoss || 0);
              if (calculatedTotal >= 0) {
                setFormData((prev) => ({ ...prev, totalAmount: calculatedTotal }));
              }
            }
          }}
          className="mt-2 text-sm text-accent hover:text-accent-ink"
        >
          자동 계산으로 되돌리기
        </button>
      )}
    </SnapshotAmountField>
  );
}
