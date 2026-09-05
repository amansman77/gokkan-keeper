import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createCashFlow, getGranaries } from '../lib/api';
import type { CreateCashFlow, GranaryWithLatestSnapshot } from '../lib/types';

export default function NewCashFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const granaryIdParam = searchParams.get('granaryId');

  const [granaries, setGranaries] = useState<GranaryWithLatestSnapshot[]>([]);
  const [formData, setFormData] = useState<CreateCashFlow>({
    granaryId: granaryIdParam || '',
    date: new Date().toISOString().split('T')[0],
    type: 'DEPOSIT',
    amount: 0,
    memo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGranaries()
      .then(setGranaries)
      .catch((err: any) => setError(err.message || '곳간 목록을 불러오는데 실패했습니다.'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.granaryId || !formData.amount || formData.amount <= 0) return;

    setLoading(true);
    setError(null);
    try {
      await createCashFlow({
        ...formData,
        memo: formData.memo || undefined,
      });
      navigate(granaryIdParam ? `/granaries/${granaryIdParam}` : '/dashboard');
    } catch (err: any) {
      setError(err.message || '입출금 기록 등록에 실패했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="gk-narrow">
      <h1 className="gk-page-title mb-8">입출금 추가</h1>

      <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
        <div>
          <label htmlFor="granaryId" className="gk-label">
            곳간
          </label>
          <select
            id="granaryId"
            required
            value={formData.granaryId}
            onChange={(e) => setFormData((prev) => ({ ...prev, granaryId: e.target.value }))}
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
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            className="gk-input"
          />
        </div>

        <div>
          <label htmlFor="type" className="gk-label">
            구분
          </label>
          <select
            id="type"
            required
            value={formData.type}
            onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as CreateCashFlow['type'] }))}
            className="gk-input"
          >
            <option value="DEPOSIT">입금 (곳간에 넣은 돈)</option>
            <option value="WITHDRAWAL">출금 (곳간에서 뺀 돈)</option>
          </select>
        </div>

        <div>
          <label htmlFor="amount" className="gk-label">
            금액
          </label>
          <input
            type="number"
            id="amount"
            step="any"
            min="0"
            required
            value={formData.amount || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: Number(e.target.value) }))}
            placeholder="예: 4000000"
            className="gk-input"
          />
          <p className="gk-meta mt-2">
            스냅샷 총액에는 매매 손익뿐 아니라 이 곳간에 새로 넣거나 뺀 돈도 섞여 있어요. 여기 기록해두면 실제 투자 성과를
            원금 증감분과 분리해서 볼 수 있어요.
          </p>
        </div>

        <div>
          <label htmlFor="memo" className="gk-label">
            메모 (선택)
          </label>
          <input
            type="text"
            id="memo"
            value={formData.memo || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
            placeholder="예: 정기 적립, 환전 → USD"
            className="gk-input"
          />
        </div>

        {error && (
          <div className="gk-alert">
            <p className="gk-error-text">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button type="button" onClick={() => navigate(-1)} className="gk-btn gk-btn-secondary flex-1">
            취소
          </button>
          <button type="submit" disabled={loading} className="gk-btn gk-btn-primary flex-1">
            {loading ? '등록 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
