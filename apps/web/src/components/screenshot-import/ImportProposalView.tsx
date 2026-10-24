import type { ImportResult } from '@gokkan-keeper/shared';
import { cost, money } from './format';

interface ProposalProps {
  result: ImportResult;
  createNew: Set<number>;
  onToggleNew: (index: number) => void;
  zeroMissing: boolean;
  onToggleMissing: () => void;
}

/** What applying would write: changed positions, new and missing ones, the snapshot. */
export function ImportProposalView({ result, createNew, onToggleNew, zeroMissing, onToggleMissing }: ProposalProps) {
  const proposal = result.proposal;
  if (!proposal) return null;
  const c = result.currency;
  return (
    <div className="gk-card gk-card-pad gk-stack">
      <h2 className="gk-section-heading">반영할 내용</h2>
      <p className="text-sm text-ink">
        스냅샷 {proposal.snapshot.date}: 총액 <b>{money(proposal.snapshot.totalAmount, c)}</b>
        <span className="gk-meta"> (주식 {money(proposal.snapshot.marketValue, c)} + 예수금 {money(proposal.snapshot.availableBalance, c)}, 평가손익 {money(proposal.snapshot.profitLoss, c)})</span>
      </p>
      <p className="gk-meta">포지션 {proposal.unchanged}개는 그대로예요.</p>
      {proposal.changes.length > 0 && (
        <div className="gk-table-scroll">
          <table className="gk-table">
            <thead><tr><th>바뀌는 포지션</th><th className="gk-num">수량</th><th className="gk-num">평균단가</th></tr></thead>
            <tbody>
              {proposal.changes.map((change) => (
                <tr key={change.positionId}>
                  <td>{change.name}</td>
                  <td className="gk-num">{change.before.quantity ?? '-'} → <b>{change.after.quantity}</b></td>
                  <td className="gk-num">{cost(change.before.avgCost, c)} → <b>{cost(change.after.avgCost, c)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {proposal.newHoldings.length > 0 && (
        <fieldset className="gk-stack-sm">
          <legend className="gk-label">곳간에 없는 종목</legend>
          {proposal.newHoldings.map(({ holding, suggestion }, index) => (
            <label key={index} className="flex items-start gap-2 text-sm">
              <input type="checkbox" disabled={!suggestion} checked={createNew.has(index)} onChange={() => onToggleNew(index)} className="mt-1" />
              <span>
                {suggestion ? <>{suggestion.name} ({suggestion.symbol})</> : holding.name} · {holding.quantity}주 · 평균단가 {cost(holding.avgCost, c)}
                {!suggestion && <span className="gk-meta"> — 종목코드를 몰라 직접 등록해야 해요</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {proposal.missingPositions.length > 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={zeroMissing} onChange={onToggleMissing} className="mt-1" />
          <span>화면에 없는 {proposal.missingPositions.map((m) => `${m.name}(${m.quantity}주)`).join(', ')}를 매도한 것으로 보고 0주로 바꾸기</span>
        </label>
      )}
    </div>
  );
}
