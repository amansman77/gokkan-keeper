import type { TechnicalIndicatorResult } from './technical-indicators';

/**
 * Alert rule definitions, deliberately free of D1 and network imports so the
 * same objects can be replayed over historical bars by scripts/simulate.ts.
 * If the simulator had its own copy of these conditions it could drift from
 * production and report a backtest for rules that are not the live ones.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SymbolSnapshot {
  symbol: string;
  name: string;
  positionId: string;
  position: number;
  daily: TechnicalIndicatorResult | null;
  weekly: TechnicalIndicatorResult | null;
}

export interface Alert {
  type: 'BUY' | 'SELL' | 'WARN';
  priority: 'P0' | 'P1' | 'P2';
  ruleId: string;
  symbol: string;
  title: string;
  message: string;
  action: string;
  status: 'CONFIRMED' | 'PRELIMINARY';
}

// ─── Rule engine (event-based: fire only on a false → true condition transition) ──

export interface Rule {
  ruleId: string;
  type: Alert['type'];
  priority: Alert['priority'];
  title: string;
  mode: 'daily' | 'weekly';
  condition: (snap: SymbolSnapshot) => boolean;
  message: (snap: SymbolSnapshot, label: string) => string;
  action: string;
}

export const RULES: Rule[] = [
  {
    // Momentum turn, not a trend break. Fired 116x over four months against 12
    // BUY_001 fires, and 14 of 28 symbols fired it more than once (whipsaw), so
    // it is kept as an early warning but no longer directs trades — WARN_003 does.
    ruleId: 'WARN_SELL_001',
    type: 'WARN',
    priority: 'P2',
    title: '주봉 하락 모멘텀 (관찰)',
    mode: 'weekly',
    condition: (snap) =>
      snap.position > 0 &&
      snap.weekly?.prevMacdOsc != null && snap.weekly?.macdOsc != null &&
      snap.weekly.prevMacdOsc >= 0 &&
      snap.weekly.macdOsc < 0,
    message: (_snap, label) => `${label} 주봉 MACD OSC가 양수에서 음수로 전환되었습니다.`,
    action: '관찰 (매매 지시 아님)',
  },
  {
    ruleId: 'WARN_BUY_001',
    type: 'BUY',
    priority: 'P2',
    title: '주봉 상승 모멘텀',
    mode: 'weekly',
    condition: (snap) =>
      snap.position === 0 &&
      snap.weekly?.prevMacdOsc != null && snap.weekly?.macdOsc != null &&
      snap.weekly.prevMacdOsc <= 0 &&
      snap.weekly.macdOsc > 0 &&
      snap.daily?.ma5 != null && snap.daily?.ma20 != null && snap.daily.ma5 > snap.daily.ma20 &&
      snap.daily?.rsi != null && snap.daily.rsi < 80,
    message: (_snap, label) => `${label} 주봉 MACD OSC가 음수에서 양수로 전환되었고 일봉 골든크로스 상태입니다.`,
    action: '관찰 (매매 지시 아님)',
  },
  {
    // Mirror of SELL_001: price reclaims a rising MA40. Deliberately has no
    // position filter — SELL_001 trims a holding, so this must be able to buy
    // back into one as well as open a new one.
    ruleId: 'BUY_001',
    type: 'BUY',
    priority: 'P0',
    title: '장기 추세 회복',
    mode: 'weekly',
    condition: (snap) =>
      snap.weekly?.prevClose != null && snap.weekly?.prevMa40 != null &&
      snap.weekly?.close != null && snap.weekly?.ma40 != null &&
      snap.weekly.prevClose <= snap.weekly.prevMa40 &&
      snap.weekly.close > snap.weekly.ma40 &&
      snap.weekly.ma40 > snap.weekly.prevMa40,
    message: (_snap, label) => `${label} 주봉 종가가 MA40 위로 회복했습니다 (MA40 상승 중).`,
    action: '1회 매수 단위 검토',
  },
  {
    // The trade trigger: price leaves a falling MA40. Fires selectively (27x,
    // concentrated on names that genuinely kept deteriorating). Holds the
    // SELL_001 id; the momentum rule that used to own it is now WARN_SELL_001,
    // and gk_alert_log was migrated so one id never means two rules.
    ruleId: 'SELL_001',
    type: 'SELL',
    priority: 'P0',
    title: '장기 추세 이탈',
    mode: 'weekly',
    condition: (snap) =>
      snap.position > 0 &&
      snap.weekly?.prevClose != null && snap.weekly?.prevMa40 != null &&
      snap.weekly?.close != null && snap.weekly?.ma40 != null &&
      snap.weekly.prevClose >= snap.weekly.prevMa40 &&
      snap.weekly.close < snap.weekly.ma40 &&
      snap.weekly.ma40 < snap.weekly.prevMa40,
    message: (_snap, label) => `${label} 주봉 종가가 MA40 위에서 아래로 이탈했습니다 (MA40 하락 중).`,
    action: '보유 수량 50% 매도 검토',
  },
  {
    ruleId: 'SELL_002',
    type: 'SELL',
    priority: 'P1',
    title: '급등 후 차익실현 신호',
    mode: 'daily',
    condition: (snap) =>
      snap.position > 0 &&
      snap.daily?.fiveDayReturn != null && snap.daily.fiveDayReturn >= 0.15 &&
      snap.daily?.close != null && snap.daily?.open != null && snap.daily.close < snap.daily.open &&
      snap.daily?.avgVolume20 != null && snap.daily?.volume != null && snap.daily.volume > snap.daily.avgVolume20,
    message: (_snap, label) => `${label} 단기 과열 분출 가능`,
    action: '보유 수량 50% 매도 검토',
  },
];
