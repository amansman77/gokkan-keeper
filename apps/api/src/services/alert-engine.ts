import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { getTechnicalIndicators } from './technical-indicators';
import type { TechnicalIndicatorResult } from './technical-indicators';

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

interface AlertIndicatorLog {
  weeklyMacdOsc: number | null;
  prevWeeklyMacdOsc: number | null;
  dailyRsi: number | null;
  dailyAdx: number | null;
  ma5: number | null;
  ma20: number | null;
  fiveDayReturn: number | null;
  volume: number | null;
  avgVolume20: number | null;
}

// ─── Rule scheduling ──────────────────────────────────────────────────────────

const DAILY_RULES = ['SELL_002', 'WARN_001'];
const FRIDAY_RULES = ['SELL_001', 'BUY_001', 'WARN_002'];

// ─── Rule engine ──────────────────────────────────────────────────────────────

function evaluateRules(snap: SymbolSnapshot, mode: 'daily' | 'weekly'): Alert[] {
  const alerts: Alert[] = [];
  const { symbol, name, position, daily, weekly } = snap;
  const label = `${name} (${symbol})`;
  const activeRules = mode === 'daily' ? DAILY_RULES : FRIDAY_RULES;

  // SELL_001 — 주봉 MACD 음수권 하락 (금요일 확정)
  if (activeRules.includes('SELL_001') &&
    position > 0 &&
    weekly?.macdOsc != null && weekly?.prevMacdOsc != null &&
    weekly.macdOsc < 0 &&
    weekly.macdOsc < weekly.prevMacdOsc
  ) {
    alerts.push({
      type: 'SELL', priority: 'P0', ruleId: 'SELL_001', symbol, status: 'CONFIRMED',
      title: '주봉 하락 모멘텀 확정',
      message: `${label} 주봉 MACD OSC가 음수권에서 하락 중입니다.`,
      action: '보유 수량의 50% 매도 검토',
    });
  }

  // SELL_002 — 급등 후 음봉 (매일)
  if (activeRules.includes('SELL_002') &&
    position > 0 &&
    daily?.fiveDayReturn != null && daily.fiveDayReturn >= 0.15 &&
    daily?.close != null && daily?.open != null && daily.close < daily.open &&
    daily?.avgVolume20 != null && daily?.volume != null && daily.volume > daily.avgVolume20
  ) {
    alerts.push({
      type: 'SELL', priority: 'P1', ruleId: 'SELL_002', symbol, status: 'CONFIRMED',
      title: '급등 후 음봉',
      message: `${label} 단기 과열 분출 가능`,
      action: '급등주면 50% 매도 검토',
    });
  }

  // BUY_001 — 신규 매수 후보 (금요일 확정, 양수권 상승만)
  if (activeRules.includes('BUY_001') &&
    position === 0 &&
    weekly?.macdOsc != null && weekly?.prevMacdOsc != null &&
    weekly.macdOsc > 0 &&
    weekly.macdOsc > weekly.prevMacdOsc &&
    daily?.ma5 != null && daily?.ma20 != null && daily.ma5 > daily.ma20 &&
    daily?.rsi != null && daily.rsi < 75
  ) {
    alerts.push({
      type: 'BUY', priority: 'P1', ruleId: 'BUY_001', symbol, status: 'CONFIRMED',
      title: '신규 매수 후보',
      message: `${label} 주봉 MACD 상승 전환 확정 + 일봉 골든크로스`,
      action: '1회 매수 단위 검토',
    });
  }

  // WARN_002 — 주봉 상승 모멘텀 둔화 (금요일 확정)
  if (activeRules.includes('WARN_002') &&
    position > 0 &&
    weekly?.macdOsc != null && weekly?.prevMacdOsc != null &&
    weekly.macdOsc > 0 &&
    weekly.macdOsc < weekly.prevMacdOsc
  ) {
    alerts.push({
      type: 'WARN', priority: 'P2', ruleId: 'WARN_002', symbol, status: 'CONFIRMED',
      title: '주봉 상승 모멘텀 둔화',
      message: `${label} 주봉 MACD OSC는 아직 양수지만 전주 대비 둔화되었습니다.`,
      action: '즉시 매도보다 관찰. 추가 하락 시 매도 검토',
    });
  }

  // WARN_001 — 과열 경고 (매일)
  if (activeRules.includes('WARN_001') && (
    (daily?.rsi != null && daily.rsi >= 85) ||
    (daily?.adx != null && daily.adx >= 50 &&
     daily?.close != null && daily?.ma20 != null &&
     Math.abs(daily.close - daily.ma20) / daily.ma20 >= 0.2)
  )) {
    alerts.push({
      type: 'WARN', priority: 'P2', ruleId: 'WARN_001', symbol, status: 'CONFIRMED',
      title: '과열 경고',
      message: `${label} 추격매수 금지`,
      action: '신규 매수 금지',
    });
  }

  return alerts;
}

// ─── Dedup ────────────────────────────────────────────────────────────────────

function todayKst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function isAlreadySent(db: D1Database, key: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM gk_alert_sent WHERE alert_key = ?').bind(key).first();
  return !!row;
}

async function markSent(db: D1Database, key: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO gk_alert_sent (alert_key, sent_at) VALUES (?, ?)')
    .bind(key, new Date().toISOString()).run();
}

// ─── Alert log ────────────────────────────────────────────────────────────────

async function logAlert(db: D1Database, alert: Alert, date: string, snap: SymbolSnapshot): Promise<void> {
  const indicators: AlertIndicatorLog = {
    weeklyMacdOsc: snap.weekly?.macdOsc ?? null,
    prevWeeklyMacdOsc: snap.weekly?.prevMacdOsc ?? null,
    dailyRsi: snap.daily?.rsi ?? null,
    dailyAdx: snap.daily?.adx ?? null,
    ma5: snap.daily?.ma5 ?? null,
    ma20: snap.daily?.ma20 ?? null,
    fiveDayReturn: snap.daily?.fiveDayReturn ?? null,
    volume: snap.daily?.volume ?? null,
    avgVolume20: snap.daily?.avgVolume20 ?? null,
  };
  await db.prepare(`
    INSERT INTO gk_alert_log (symbol, rule_id, date, priority, status, action, indicators_json, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    alert.symbol, alert.ruleId, date, alert.priority, alert.status,
    alert.action, JSON.stringify(indicators), new Date().toISOString(),
  ).run();
}

// ─── Discord push ─────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, number> = {
  P0: 0xe74c3c,
  P1: 0xe67e22,
  P2: 0xf1c40f,
};
const TYPE_EMOJI: Record<string, string> = { BUY: '🟢', SELL: '🔴', WARN: '⚠️' };

function buildIndicatorFields(alert: Alert, snap: SymbolSnapshot): Array<{ name: string; value: string; inline: boolean }> {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  const fmt = (n: number | null | undefined, digits = 2) => n != null ? n.toFixed(digits) : '-';

  if (alert.ruleId === 'SELL_001' || alert.ruleId === 'BUY_001' || alert.ruleId === 'WARN_002') {
    const fmtObv = (n: number | null | undefined) => n != null ? `${(n / 1_000_000).toFixed(2)}M` : '-';
    fields.push(
      { name: '주봉 MACD OSC', value: fmt(snap.weekly?.macdOsc, 3), inline: true },
      { name: '전주 MACD OSC', value: fmt(snap.weekly?.prevMacdOsc, 3), inline: true },
      { name: '일봉 RSI(14)', value: fmt(snap.daily?.rsi, 1), inline: true },
      { name: '주봉 ADX(14)', value: fmt(snap.weekly?.adx, 1), inline: true },
      { name: '주봉 OBV', value: fmtObv(snap.weekly?.obv), inline: true },
    );
    if (alert.ruleId === 'BUY_001') {
      fields.push(
        { name: 'MA5', value: fmt(snap.daily?.ma5), inline: true },
        { name: 'MA20', value: fmt(snap.daily?.ma20), inline: true },
        { name: '일봉 ADX(14)', value: fmt(snap.daily?.adx, 1), inline: true },
      );
    }
  }

  if (alert.ruleId === 'SELL_002') {
    const ret = snap.daily?.fiveDayReturn;
    fields.push(
      { name: '5일 수익률', value: ret != null ? `${(ret * 100).toFixed(1)}%` : '-', inline: true },
      { name: '당일 거래량', value: fmt(snap.daily?.volume, 0), inline: true },
      { name: '20일 평균 거래량', value: fmt(snap.daily?.avgVolume20, 0), inline: true },
    );
  }

  if (alert.ruleId === 'WARN_001') {
    fields.push(
      { name: '일봉 RSI(14)', value: fmt(snap.daily?.rsi, 1), inline: true },
      { name: 'ADX(14)', value: fmt(snap.daily?.adx, 1), inline: true },
      { name: 'MA20 괴리율', value: snap.daily?.close != null && snap.daily?.ma20 != null
          ? `${(Math.abs(snap.daily.close - snap.daily.ma20) / snap.daily.ma20 * 100).toFixed(1)}%`
          : '-', inline: true },
    );
  }

  return fields;
}

async function sendDiscordAlert(alert: Alert, snap: SymbolSnapshot, webhookUrl: string): Promise<void> {
  const fields = buildIndicatorFields(alert, snap);
  const payload = {
    embeds: [{
      title: `${TYPE_EMOJI[alert.type]} [${alert.priority}] ${alert.title}`,
      description: `${alert.message}\n\n**권장 액션:** ${alert.action}`,
      color: PRIORITY_COLOR[alert.priority] ?? 0x95a5a6,
      fields,
      footer: { text: `Rule: ${alert.ruleId} · ${alert.status}` },
      timestamp: new Date().toISOString(),
    }],
  };
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function runAlertEngine(env: Env, mode: 'daily' | 'weekly'): Promise<{ processed: number; sent: number }> {
  if (!env.DISCORD_WEBHOOK_URL) return { processed: 0, sent: 0 };

  const db = new DBClient(env.DB);
  const positions = await db.getPositions();
  const today = todayKst();
  let processed = 0, sent = 0;

  for (const position of positions) {
    // Reuse D1-cached indicators (6h TTL) — no extra Yahoo Finance calls on cache hit
    const [daily, weekly] = await Promise.all([
      getTechnicalIndicators(position.symbol, position.market ?? null, '1d', env.YAHOO_FINANCE_API_BASE_URL, env.DB),
      getTechnicalIndicators(position.symbol, position.market ?? null, '1wk', env.YAHOO_FINANCE_API_BASE_URL, env.DB),
    ]);

    if (!daily && !weekly) continue;
    processed++;

    const snap: SymbolSnapshot = {
      symbol: position.symbol,
      name: position.name,
      positionId: position.id,
      position: position.quantity ?? 0,
      daily,
      weekly,
    };

    for (const alert of evaluateRules(snap, mode)) {
      const key = `${alert.symbol}:${alert.ruleId}:${today}`;
      if (await isAlreadySent(env.DB, key)) continue;
      await sendDiscordAlert(alert, snap, env.DISCORD_WEBHOOK_URL!);
      await Promise.all([markSent(env.DB, key), logAlert(env.DB, alert, today, snap)]);
      sent++;
    }
  }

  return { processed, sent };
}
