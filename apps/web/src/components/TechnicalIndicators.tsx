import { useEffect, useState } from 'react';
import { getPositionIndicators } from '../lib/api';
import type { TechnicalIndicatorResult } from '../lib/api';

interface Props {
  symbol: string;
  market?: string | null;
}

function rsiLabel(rsi: number): { text: string; color: string } {
  if (rsi >= 70) return { text: '과매수', color: 'text-loss' };
  if (rsi <= 30) return { text: '과매도', color: 'text-accent' };
  return { text: '중립', color: 'text-ink-muted' };
}

function adxLabel(adx: number): string {
  if (adx >= 50) return '매우 강한 추세';
  if (adx >= 25) return '추세 있음';
  return '추세 없음(횡보)';
}

function formatObv(obv: number): string {
  const abs = Math.abs(obv);
  const sign = obv < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export default function TechnicalIndicators({ symbol, market }: Props) {
  const [interval, setInterval] = useState<'1d' | '1wk'>('1d');
  const [data, setData] = useState<TechnicalIndicatorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    getPositionIndicators(symbol, market, interval)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [symbol, market, interval]);

  if (loading) {
    return <p className="text-xs text-ink-faint mt-2">지표 계산 중...</p>;
  }

  if (error) {
    return <p className="text-xs text-ink-faint mt-2">지표 조회 불가 (Yahoo Finance 미지원 종목)</p>;
  }

  if (!data) return null;

  const rsiInfo = data.rsi !== null ? rsiLabel(data.rsi) : null;

  return (
    <div className="mt-3 pt-3 border-t border-line-soft">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-ink-faint">기술적 지표 · {data.asOfDate} 기준</p>
        <div className="flex text-xs border border-line-soft rounded overflow-hidden">
          <button
            onClick={() => setInterval('1d')}
            className={`px-2 py-0.5 ${interval === '1d' ? 'bg-accent text-accent-contrast' : 'text-ink-faint hover:bg-surface-2'}`}
          >
            일봉
          </button>
          <button
            onClick={() => setInterval('1wk')}
            className={`px-2 py-0.5 ${interval === '1wk' ? 'bg-accent text-accent-contrast' : 'text-ink-faint hover:bg-surface-2'}`}
          >
            주봉
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* RSI */}
        <div className="bg-surface-2 rounded p-2">
          <p className="text-xs text-ink-faint font-medium">RSI (14)</p>
          {data.rsi !== null ? (
            <>
              <p className="text-base font-bold text-ink">{data.rsi.toFixed(1)}</p>
              <p className={`text-xs ${rsiInfo!.color}`}>{rsiInfo!.text}</p>
            </>
          ) : <p className="text-xs text-ink-faint">데이터 부족</p>}
        </div>

        {/* MACD OSC */}
        <div className="bg-surface-2 rounded p-2">
          <p className="text-xs text-ink-faint font-medium">MACD OSC</p>
          {data.macdOsc !== null ? (
            <>
              <p className={`text-base font-bold ${data.macdOsc >= 0 ? 'text-loss' : 'text-accent'}`}>
                {data.macdOsc >= 0 ? '+' : ''}{data.macdOsc.toFixed(3)}
              </p>
              <p className="text-xs text-ink-faint">{data.macdOsc >= 0 ? '상승 모멘텀' : '하락 모멘텀'}</p>
            </>
          ) : <p className="text-xs text-ink-faint">데이터 부족</p>}
        </div>

        {/* OBV */}
        <div className="bg-surface-2 rounded p-2">
          <p className="text-xs text-ink-faint font-medium">OBV</p>
          {data.obv !== null ? (
            <>
              <p className="text-base font-bold text-ink">{formatObv(data.obv)}</p>
              <p className="text-xs text-ink-faint">{data.obv >= 0 ? '매수 우위' : '매도 우위'}</p>
            </>
          ) : <p className="text-xs text-ink-faint">데이터 부족</p>}
        </div>

        {/* ADX */}
        <div className="bg-surface-2 rounded p-2">
          <p className="text-xs text-ink-faint font-medium">ADX (14)</p>
          {data.adx !== null ? (
            <>
              <p className="text-base font-bold text-ink">{data.adx.toFixed(1)}</p>
              <p className="text-xs text-ink-faint">{adxLabel(data.adx)}</p>
              {data.diPlus !== null && data.diMinus !== null && (
                <p className="text-xs text-ink-faint">
                  +DI {data.diPlus.toFixed(1)} / -DI {data.diMinus.toFixed(1)}
                </p>
              )}
            </>
          ) : <p className="text-xs text-ink-faint">데이터 부족</p>}
        </div>
      </div>
    </div>
  );
}
