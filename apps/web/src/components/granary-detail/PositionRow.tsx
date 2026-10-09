import { formatCurrency, formatDate, getPositionMarketValue } from '@gokkan-keeper/shared';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { Position } from '../../lib/types';
import TechnicalIndicators from '../TechnicalIndicators';

const getPriceSourceLabel = (source: Position['currentPriceSource']) => {
  if (source === 'FSC_STOCK_PRICE_API') return '금융위원회 시세';
  if (source === 'YAHOO_FINANCE') return 'Yahoo Finance';
  return null;
};

interface Props {
  position: Position;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => Promise<void>;
}
export function PositionRow({ position, currency, expanded, onToggle, onDelete }: Props) {
  const marketValue = getPositionMarketValue(position);
  const rate = position.currentPriceChangeRate;
  const isExpanded = expanded;
  return (
    <Fragment key={position.id}>
      <tr className="border-b last:border-0 hover:bg-surface-2">
        <td>
          <div className="font-medium text-ink flex items-center gap-2">
            {position.name}
            {position.isPublic && (
              <span className="text-[10px] font-semibold text-accent bg-accent-tint px-1.5 py-0.5 rounded">
                공개
              </span>
            )}
          </div>
          <div className="gk-meta">
            {position.symbol}
            <span className="hidden sm:inline">
              {position.currentPriceAsOf ? ` · ${formatDate(position.currentPriceAsOf)}` : ''}
              {getPriceSourceLabel(position.currentPriceSource) ? ` · ${getPriceSourceLabel(position.currentPriceSource)}` : ''}
            </span>
          </div>
        </td>
        <td className="gk-num">{position.quantity ?? '-'}</td>
        <td className="gk-num gk-hide-narrow">
          {position.currentUnitPrice !== null && position.currentUnitPrice !== undefined
            ? formatCurrency(position.currentUnitPrice, currency)
            : '-'}
        </td>
        <PriceChangeCell rate={rate} />
        <td className="gk-num font-semibold">
          {marketValue !== null ? formatCurrency(marketValue, currency) : '-'}
        </td>
        <td>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
            <button
              onClick={() => onToggle()}
              className="text-ink-faint hover:text-ink-muted text-xs border border-line rounded px-1.5 py-0.5 whitespace-nowrap"
            >
              {isExpanded ? '지표 닫기' : '지표 보기'}
            </button>
            <Link to={`/positions/${position.id}/edit`} className="text-accent hover:underline text-xs whitespace-nowrap">
              수정
            </Link>
            <button
              onClick={async () => {
                if (!window.confirm('포지션을 삭제하시겠습니까?')) return;
                await onDelete(position.id);
              }}
              className="text-danger hover:underline text-xs whitespace-nowrap"
            >
              삭제
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-6 pb-4 bg-surface-2">
            <TechnicalIndicators symbol={position.symbol} market={position.market} />
          </td>
        </tr>
      )}
    </Fragment>
  );

}

interface PriceChangeCellProps {
  rate: number | null | undefined;
}

function PriceChangeCell({ rate }: PriceChangeCellProps) {
  return (
    <td
      className={`px-2 sm:px-4 py-3 gk-num font-medium ${rate === null || rate === undefined
        ? 'text-ink-faint'
        : rate > 0
          ? 'text-gain'
          : rate < 0
            ? 'text-loss'
            : 'text-ink-faint'
        }`}
    >
      {rate === null || rate === undefined ? '-' : `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`}
    </td>
  );
}
