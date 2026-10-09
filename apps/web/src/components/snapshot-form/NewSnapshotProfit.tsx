import { formatCurrency } from '@gokkan-keeper/shared';
import { SnapshotAmountField } from './SnapshotFields';
import type { NewSnapshotState } from './useNewSnapshot';
interface NewSnapshotProfitProps {
  state: NewSnapshotState;
}

export function NewSnapshotProfit({ state }: NewSnapshotProfitProps) {
  const { formData, setFormData, positions, granaries, isTotalAmountManual, setIsTotalAmountManual, isProfitLossManual, setIsProfitLossManual } = state;
  return (
    <SnapshotAmountField id="profitLoss" label="평가 손익 (선택)" value={formData.profitLoss}
      onChange={(value) => {
        setIsProfitLossManual(true);
        setIsTotalAmountManual(false);
        setFormData({ ...formData, profitLoss: value ? parseFloat(value) : undefined });
      }}
      hint={<>
        {isTotalAmountManual && !isProfitLossManual && formData.availableBalance !== undefined && (
          <span className="ml-2 text-xs text-ink-faint">(자동 계산됨)</span>
        )}
      </>}>

      {isTotalAmountManual && isProfitLossManual && formData.availableBalance !== undefined && (
        <button
          type="button"
          onClick={() => setIsProfitLossManual(false)}
          className="mt-2 text-sm text-accent hover:text-accent-ink"
        >
          자동 계산으로 되돌리기
        </button>
      )}
      {(() => {
        const positionProfitLossTotal = positions
          .filter((p) => p.profitLoss != null)
          .reduce((sum, p) => sum + (p.profitLoss ?? 0), 0);
        const selectedGranary = granaries.find((g) => g.id === formData.granaryId);
        if (!selectedGranary || !positions.some((p) => p.profitLoss != null)) return null;
        return (
          <button
            type="button"
            onClick={() => {
              setIsProfitLossManual(true);
              setIsTotalAmountManual(false);
              setFormData((prev) => ({ ...prev, profitLoss: positionProfitLossTotal }));
            }}
            className="mt-2 text-sm text-success hover:text-success"
          >
            포지션 합산 적용 ({formatCurrency(positionProfitLossTotal, selectedGranary.currency)})
          </button>
        );
      })()}
    </SnapshotAmountField>
  );
}
