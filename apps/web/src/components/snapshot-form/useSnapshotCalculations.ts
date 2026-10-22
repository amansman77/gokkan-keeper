import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { CreateSnapshot } from '../../lib/types';
export function useSnapshotCalculations(formData: CreateSnapshot, setFormData: Dispatch<SetStateAction<CreateSnapshot>>, isTotalAmountManual: boolean, isProfitLossManual: boolean) {
  // 예수금과 평가 손익이 모두 입력되면 총 평가 금액 자동 계산
  useEffect(() => {
    if (!isTotalAmountManual && formData.availableBalance !== undefined && formData.profitLoss !== undefined) {
      const calculatedTotal = (formData.availableBalance || 0) + (formData.profitLoss || 0);
      if (calculatedTotal >= 0) {
        setFormData((prev) => ({ ...prev, totalAmount: calculatedTotal }));
      }
    }
  }, [formData.availableBalance, formData.profitLoss, isTotalAmountManual]);

  // 총 평가 금액(수동)과 예수금이 모두 입력되면 평가 손익 자동 계산
  useEffect(() => {
    if (isTotalAmountManual && !isProfitLossManual && formData.availableBalance !== undefined) {
      setFormData((prev) => ({ ...prev, profitLoss: prev.totalAmount - (formData.availableBalance || 0) }));
    }
  }, [formData.totalAmount, formData.availableBalance, isTotalAmountManual, isProfitLossManual]);
}
