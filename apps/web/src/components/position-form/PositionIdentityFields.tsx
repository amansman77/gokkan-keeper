import type { Dispatch, SetStateAction } from 'react';
import type { CreatePosition, Granary } from '../../lib/types';
interface FieldProps { formData: CreatePosition; setFormData: Dispatch<SetStateAction<CreatePosition>>; }
export function PositionIdentityFields({ formData, setFormData, granaries, quoteLoading, quoteMessage }: FieldProps & { granaries: Granary[]; quoteLoading: boolean; quoteMessage: string | null }) {
  return <>
    <div>
      <label htmlFor="granaryId" className="gk-label">곳간(선택)</label>
      <select
        id="granaryId"
        value={formData.granaryId || ''}
        onChange={(e) => setFormData({ ...formData, granaryId: e.target.value || null })}
        className="gk-input"
      >
        <option value="">미분류</option>
        {granaries.map((granary) => (
          <option key={granary.id} value={granary.id}>
            {granary.name} ({granary.purpose})
          </option>
        ))}
      </select>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="name" className="gk-label">종목명</label>
        <input
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="gk-input"
        />
      </div>
      <div>
        <label htmlFor="symbol" className="gk-label">심볼</label>
        <input
          id="symbol"
          required
          value={formData.symbol}
          onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
          className="gk-input"
          placeholder="005930 / AAPL / 7203.T"
        />
        <p className="mt-1 text-xs text-ink-faint">국내 6자리 코드 또는 해외 Yahoo Finance 심볼을 입력하면 저장 후 현재가를 자동 조회합니다.</p>
        {quoteLoading && <p className="mt-1 text-xs text-accent">현재가 자동 조회 중...</p>}
        {!quoteLoading && quoteMessage && (
          <p
            className={`mt-1 text-xs ${quoteMessage.includes('완료')
              ? 'text-gain'
              : quoteMessage.includes('수동 입력')
                ? 'text-ink-faint'
                : 'text-flow'
              }`}
          >
            {quoteMessage}
          </p>
        )}
      </div>
    </div>

  </>;
}
