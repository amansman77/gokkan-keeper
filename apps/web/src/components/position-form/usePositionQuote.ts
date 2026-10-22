import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { lookupPositionQuote } from '../../lib/api';
import type { CreatePosition } from '../../lib/types';
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

export function usePositionQuote(formData: CreatePosition, setFormData: Dispatch<SetStateAction<CreatePosition>>, enableQuoteAutoFill: boolean) {
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const canAutoPrice = supportsAutoPrice(formData.symbol, formData.market, formData.assetType);
  const lastLookupKeyRef = useRef<string>('');
  const lookupSequenceRef = useRef(0);

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

    const lookupQuote = async () => {
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
      } catch (error: unknown) {
        if (cancelled || lookupSequence !== lookupSequenceRef.current) {
          return;
        }
        const message = error instanceof Error ? error.message : '';
        if (message === 'Quote not found') {
          setQuoteMessage('자동 시세를 찾지 못해 수동 입력으로 진행합니다.');
        } else {
          setQuoteMessage(message || '현재가 자동 조회에 실패했습니다.');
        }
      } finally {
        if (!cancelled && lookupSequence === lookupSequenceRef.current) {
          setQuoteLoading(false);
        }
      }
    };
    const timer = window.setTimeout(() => { void lookupQuote(); }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canAutoPrice, enableQuoteAutoFill, formData.assetType, formData.market, formData.symbol]);

  return { canAutoPrice, quoteLoading, quoteMessage };
}
