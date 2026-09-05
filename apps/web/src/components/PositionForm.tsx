import { useEffect, useRef, useState } from 'react';
import type { CreatePosition, Granary } from '../lib/types';
import {
  POSITION_ASSET_TYPES,
  POSITION_MARKETS,
  formatPublicPositionValidationError,
  validatePublicPositionInput,
} from '@gokkan-keeper/shared';
import { lookupPositionQuote } from '../lib/api';
import { PositionPricingSection } from './position-form/PositionPricingSection';
import { PositionPublicSection } from './position-form/PositionPublicSection';

interface PositionFormProps {
  granaries: Granary[];
  initialData: CreatePosition;
  loading: boolean;
  error: string | null;
  submitLabel: string;
  enableQuoteAutoFill?: boolean;
  onSubmit: (data: CreatePosition) => Promise<void>;
  onCancel: () => void;
}

const AUTO_PRICE_SUPPORTED_MARKETS = new Set([
  'KRX',
  'KOSDAQ',
  'KOSPI',
  'KONEX',
  'NASDAQ',
  'NYSE',
  'AMEX',
  'TSE',
  'HKEX',
  'SSE',
  'SZSE',
]);
const AUTO_PRICE_SUPPORTED_ASSET_TYPES = new Set(['STOCK', 'ETF']);

function parseNullableNumber(value: string): number | null {
  return value ? Number.parseFloat(value) : null;
}

function supportsAutoPrice(symbol: string, market: string | null | undefined, assetType: string | null | undefined) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return false;

  const normalizedAssetType = assetType?.trim().toUpperCase();
  if (normalizedAssetType && !AUTO_PRICE_SUPPORTED_ASSET_TYPES.has(normalizedAssetType)) {
    return false;
  }

  if (market) {
    return AUTO_PRICE_SUPPORTED_MARKETS.has(market.toUpperCase());
  }

  return /^\d{6}$/.test(normalizedSymbol) || /^[A-Z][A-Z0-9.\-=/^]{0,14}$/.test(normalizedSymbol);
}

export default function PositionForm({
  granaries,
  initialData,
  loading,
  error,
  submitLabel,
  enableQuoteAutoFill = false,
  onSubmit,
  onCancel,
}: PositionFormProps) {
  const [formData, setFormData] = useState<CreatePosition>(initialData);
  const [clientError, setClientError] = useState<string | null>(null);
  const [showManualCurrentValue, setShowManualCurrentValue] = useState(
    initialData.currentValue !== null && initialData.currentValue !== undefined
  );
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const hasCustomMarket = !!formData.market && !POSITION_MARKETS.includes(formData.market as any);
  const hasCustomAssetType = !!formData.assetType && !POSITION_ASSET_TYPES.includes(formData.assetType as any);
  const canAutoPrice = supportsAutoPrice(formData.symbol, formData.market, formData.assetType);
  const lastLookupKeyRef = useRef<string>('');
  const lookupSequenceRef = useRef(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePublicPositionInput({
      ...formData,
      supportsAutomaticPrice: enableQuoteAutoFill && canAutoPrice,
    });
    if (validationError) {
      setClientError(formatPublicPositionValidationError(validationError, 'ko'));
      return;
    }
    setClientError(null);
    await onSubmit(formData);
  };

  useEffect(() => {
    if (!enableQuoteAutoFill || !canAutoPrice) {
      setQuoteLoading(false);
      setQuoteMessage(null);
      lastLookupKeyRef.current = '';
      return;
    }

    let cancelled = false;
    const normalizedSymbol = formData.symbol.trim().toUpperCase();
    const lookupKey = `${normalizedSymbol}:${formData.market || ''}:${formData.assetType || ''}`;
    if (lookupKey === lastLookupKeyRef.current) return;
    const lookupSequence = lookupSequenceRef.current + 1;
    lookupSequenceRef.current = lookupSequence;

    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteMessage(null);
      try {
        const quote = await lookupPositionQuote(normalizedSymbol, formData.market, formData.assetType);
        if (cancelled || lookupSequence !== lookupSequenceRef.current) {
          return;
        }
        lastLookupKeyRef.current = lookupKey;
        setFormData((prev) => ({
          ...prev,
          name: prev.name.trim() ? prev.name : (quote.name ?? prev.name),
          market: quote.market ?? prev.market,
          assetType: prev.assetType ?? quote.assetType,
          currentValue: quote.currentUnitPrice,
        }));
        setQuoteMessage(`자동 입력 완료 · ${quote.currentPriceAsOf} 종가 기준`);
      } catch (error: any) {
        if (cancelled || lookupSequence !== lookupSequenceRef.current) {
          return;
        }
        if (error.message === 'Quote not found') {
          setQuoteMessage('자동 시세를 찾지 못해 수동 입력으로 진행합니다.');
        } else {
          setQuoteMessage(error.message || '현재가 자동 조회에 실패했습니다.');
        }
      } finally {
        if (!cancelled && lookupSequence === lookupSequenceRef.current) {
          setQuoteLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canAutoPrice, enableQuoteAutoFill, formData.assetType, formData.market, formData.symbol]);

  return (
    <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
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
              className={`mt-1 text-xs ${
                quoteMessage.includes('완료')
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="market" className="gk-label">시장(선택)</label>
          <select
            id="market"
            value={formData.market || ''}
            onChange={(e) => setFormData({ ...formData, market: e.target.value || null })}
            className="gk-input"
          >
            <option value="">선택 안 함</option>
            {POSITION_MARKETS.map((market) => (
              <option key={market} value={market}>
                {market}
              </option>
            ))}
            {hasCustomMarket && <option value={formData.market || ''}>{formData.market}</option>}
          </select>
        </div>
        <div>
          <label htmlFor="assetType" className="gk-label">자산유형(선택)</label>
          <select
            id="assetType"
            value={formData.assetType || ''}
            onChange={(e) => setFormData({ ...formData, assetType: e.target.value || null })}
            className="gk-input"
          >
            <option value="">선택 안 함</option>
            {POSITION_ASSET_TYPES.map((assetType) => (
              <option key={assetType} value={assetType}>
                {assetType}
              </option>
            ))}
            {hasCustomAssetType && <option value={formData.assetType || ''}>{formData.assetType}</option>}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="quantity" className="gk-label">수량(선택)</label>
          <input
            id="quantity"
            type="number"
            step="0.0001"
            value={formData.quantity ?? ''}
            onChange={(e) => setFormData({ ...formData, quantity: parseNullableNumber(e.target.value) })}
            className="gk-input"
          />
        </div>
        <div>
          <label htmlFor="avgCost" className="gk-label">평균단가(선택)</label>
          <input
            id="avgCost"
            type="number"
            step="0.0001"
            value={formData.avgCost ?? ''}
            onChange={(e) => setFormData({ ...formData, avgCost: parseNullableNumber(e.target.value) })}
            className="gk-input"
          />
        </div>
        <PositionPricingSection
          formData={formData}
          canAutoPrice={canAutoPrice}
          showManualCurrentValue={showManualCurrentValue}
          setShowManualCurrentValue={setShowManualCurrentValue}
          setFormData={setFormData}
        />
      </div>

      <PositionPublicSection formData={formData} setFormData={setFormData} />

      <div>
        <label htmlFor="note" className="gk-label">메모(비공개)</label>
        <textarea
          id="note"
          rows={3}
          value={formData.note || ''}
          onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
          className="gk-input"
        />
      </div>

      {(clientError || error) && (
        <div className="gk-alert">
          <p className="gk-error-text">{clientError || error}</p>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="gk-btn gk-btn-secondary flex-1"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="gk-btn gk-btn-primary flex-1"
        >
          {loading ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
