import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createSnapshot, getGranaries, getPositions } from '../lib/api';
import { formatCurrency } from '@gokkan-keeper/shared';
import type { CreateSnapshot, GranaryWithLatestSnapshot, Position } from '../lib/types';

export default function NewSnapshot() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const granaryIdParam = searchParams.get('granaryId');

  const [granaries, setGranaries] = useState<GranaryWithLatestSnapshot[]>([]);
  const [formData, setFormData] = useState<CreateSnapshot>({
    granaryId: granaryIdParam || '',
    date: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    availableBalance: undefined,
    profitLoss: undefined,
    memo: '',
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [isTotalAmountManual, setIsTotalAmountManual] = useState(false);
  const [isProfitLossManual, setIsProfitLossManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyLatestSnapshotDefaults = (granaryId: string, granaryList: GranaryWithLatestSnapshot[]) => {
    const selectedGranary = granaryList.find((item) => item.id === granaryId);
    const latestSnapshot = selectedGranary?.latestSnapshot;

    setIsTotalAmountManual(false);
    setIsProfitLossManual(false);
    setFormData((prev) => ({
      ...prev,
      granaryId,
      totalAmount: latestSnapshot?.totalAmount ?? 0,
      availableBalance: latestSnapshot?.availableBalance,
      profitLoss: latestSnapshot?.profitLoss,
    }));
  };

  useEffect(() => {
    async function loadGranaries() {
      try {
        const data = await getGranaries();
        setGranaries(data);
        if (granaryIdParam && data.length > 0) {
          applyLatestSnapshotDefaults(granaryIdParam, data);
        }
      } catch (err: any) {
        setError(err.message || '곳간 목록을 불러오는데 실패했습니다.');
      }
    }
    loadGranaries();
  }, [granaryIdParam]);

  useEffect(() => {
    if (!formData.granaryId) {
      setPositions([]);
      return;
    }
    getPositions(formData.granaryId).then(setPositions).catch(() => setPositions([]));
  }, [formData.granaryId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const snapshot = await createSnapshot(formData);
      navigate(`/granaries/${snapshot.granaryId}`);
    } catch (err: any) {
      setError(err.message || '스냅샷 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="gk-page-title mb-8">새 스냅샷 추가</h1>

      <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
        <div>
          <label htmlFor="granaryId" className="gk-label">
            곳간
          </label>
          <select
            id="granaryId"
            required
            value={formData.granaryId}
            onChange={(e) => applyLatestSnapshotDefaults(e.target.value, granaries)}
            className="gk-input"
            disabled={!!granaryIdParam}
          >
            <option value="">곳간을 선택하세요</option>
            {granaries.map((granary) => (
              <option key={granary.id} value={granary.id}>
                {granary.name} ({granary.purpose})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date" className="gk-label">
            날짜
          </label>
          <input
            type="date"
            id="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="gk-input"
          />
        </div>

        <div>
          <label htmlFor="totalAmount" className="gk-label">
            총 평가 금액
            {!isTotalAmountManual && formData.availableBalance !== undefined && formData.profitLoss !== undefined && (
              <span className="ml-2 text-xs text-ink-faint">(자동 계산됨)</span>
            )}
          </label>
          <input
            type="number"
            id="totalAmount"
            required
            min="0"
            step="0.01"
            value={formData.totalAmount ?? ''}
            onChange={(e) => {
              setIsTotalAmountManual(true);
              setIsProfitLossManual(false);
              setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 });
            }}
            className="gk-input"
          />
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
        </div>

        <div>
          <label htmlFor="availableBalance" className="gk-label">
            예수금 (선택)
          </label>
          <input
            type="number"
            id="availableBalance"
            min="0"
            step="0.01"
            value={formData.availableBalance ?? ''}
            onChange={(e) => setFormData({ ...formData, availableBalance: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="gk-input"
          />
        </div>

        <div>
          <label htmlFor="profitLoss" className="gk-label">
            평가 손익 (선택)
            {isTotalAmountManual && !isProfitLossManual && formData.availableBalance !== undefined && (
              <span className="ml-2 text-xs text-ink-faint">(자동 계산됨)</span>
            )}
          </label>
          <input
            type="number"
            id="profitLoss"
            step="0.01"
            value={formData.profitLoss ?? ''}
            onChange={(e) => {
              setIsProfitLossManual(true);
              setIsTotalAmountManual(false);
              setFormData({ ...formData, profitLoss: e.target.value ? parseFloat(e.target.value) : undefined });
            }}
            className="gk-input"
            placeholder="양수: 수익, 음수: 손실"
          />
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
        </div>

        <div>
          <label htmlFor="memo" className="gk-label">
            메모 (선택)
          </label>
          <textarea
            id="memo"
            rows={3}
            value={formData.memo || ''}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value || undefined })}
            className="gk-input"
            placeholder="간단한 메모를 남기세요"
          />
        </div>

        {error && (
          <div className="gk-alert">
            <p className="gk-error-text">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 px-4 py-2 border border-line rounded-md text-ink-muted hover:bg-surface-2"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-accent text-accent-contrast rounded-md hover:bg-accent-ink disabled:opacity-50"
          >
            {loading ? '생성 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
