import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { getTechnicalIndicators } from './technical-indicators';
import type { TechnicalIndicatorResult } from './technical-indicators';
import { getMarketIndices } from './market-indices';
import type { AlertThreshold } from '@gokkan-keeper/shared';

import type { SymbolSnapshot, Alert } from './alert-rules';
import { RULES } from './alert-rules';
export type { SymbolSnapshot, Alert } from './alert-rules';

interface AlertIndicatorLog {
  weeklyMacdOsc: number | null;
  prevWeeklyMacdOsc: number | null;
  dailyRsi: number | null;
  dailyAdx: number | null;
  ma5: number | null;
  ma20: number | null;
  weeklyMa40: number | null;
  prevWeeklyMa40: number | null;
  fiveDayReturn: number | null;
  volume: number | null;
  avgVolume20: number | null;
}

async function getRuleConditionMet(db: D1Database, symbol: string, ruleId: string): Promise<boolean> {
  const row = await db.prepare('SELECT condition_met FROM gk_alert_rule_state WHERE symbol = ? AND rule_id = ?')
    .bind(symbol, ruleId).first<{ condition_met: number }>();
  return row?.condition_met === 1;
}

async function setRuleConditionMet(db: D1Database, symbol: string, ruleId: string, conditionMet: boolean): Promise<void> {
  await db.prepare(`
    INSERT INTO gk_alert_rule_state (symbol, rule_id, condition_met, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(symbol, rule_id) DO UPDATE SET
      condition_met = excluded.condition_met,
      updated_at = excluded.updated_at
  `).bind(symbol, ruleId, conditionMet ? 1 : 0, new Date().toISOString()).run();
}

async function evaluateRules(db: D1Database, snap: SymbolSnapshot, mode: 'daily' | 'weekly'): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const label = `${snap.name} (${snap.symbol})`;

  for (const rule of RULES.filter((r) => r.mode === mode)) {
    const conditionMet = rule.condition(snap);
    const wasMet = await getRuleConditionMet(db, snap.symbol, rule.ruleId);
    if (conditionMet !== wasMet) {
      await setRuleConditionMet(db, snap.symbol, rule.ruleId, conditionMet);
    }
    if (conditionMet && !wasMet) {
      alerts.push({
        type: rule.type, priority: rule.priority, ruleId: rule.ruleId, symbol: snap.symbol, status: 'CONFIRMED',
        title: rule.title,
        message: rule.message(snap, label),
        action: rule.action,
      });
    }
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
    weeklyMa40: snap.weekly?.ma40 ?? null,
    prevWeeklyMa40: snap.weekly?.prevMa40 ?? null,
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

  if (alert.ruleId === 'WARN_SELL_001' || alert.ruleId === 'BUY_001') {
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

  if (alert.ruleId === 'WARN_SELL_002') {
    const ret = snap.daily?.fiveDayReturn;
    fields.push(
      { name: '5일 수익률', value: ret != null ? `${(ret * 100).toFixed(1)}%` : '-', inline: true },
      { name: '당일 거래량', value: fmt(snap.daily?.volume, 0), inline: true },
      { name: '20일 평균 거래량', value: fmt(snap.daily?.avgVolume20, 0), inline: true },
    );
  }

  if (alert.ruleId === 'SELL_001' || alert.ruleId === 'WARN_BUY_002') {
    fields.push(
      { name: '주봉 종가', value: fmt(snap.weekly?.close), inline: true },
      { name: 'MA40', value: fmt(snap.weekly?.ma40), inline: true },
      { name: 'MA40 방향', value: snap.weekly?.ma40 != null && snap.weekly?.prevMa40 != null
          ? (snap.weekly.ma40 < snap.weekly.prevMa40 ? '하락' : '상승')
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

// ─── FX threshold rules (event-based, reuses the rule-state/dedup machinery above) ──
// Not position-driven — checks a market index value (from market-indices.ts) against
// a user-managed threshold (gk_alert_thresholds, CRUD via /alert-thresholds). Each row
// gets its own event-transition rule id (`FX_<row id>`) so add/edit/delete just works
// without touching this file.

async function sendFxAlert(webhookUrl: string, threshold: AlertThreshold, ruleId: string, value: number): Promise<void> {
  const verb = threshold.direction === 'below' ? '이하로 하락' : '이상으로 상승';
  const payload = {
    embeds: [{
      title: `🔔 [환율] ${threshold.label} ${threshold.threshold}원 ${verb}`,
      description: `현재가: ${value.toFixed(2)}원`,
      color: threshold.direction === 'below' ? 0x3498db : 0xe74c3c,
      footer: { text: `Rule: ${ruleId}` },
      timestamp: new Date().toISOString(),
    }],
  };
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function checkFxThresholds(env: Env, today: string): Promise<{ processed: number; sent: number }> {
  let processed = 0, sent = 0;
  const db = new DBClient(env.DB);
  const thresholds = await db.getEnabledAlertThresholds();
  if (thresholds.length === 0 || !env.DISCORD_WEBHOOK_URL) return { processed, sent };

  const indices = await getMarketIndices(env.YAHOO_FINANCE_API_BASE_URL, env.DB);

  for (const threshold of thresholds) {
    const index = indices.find((i) => i.symbol === threshold.symbol);
    if (!index) continue;
    processed++;

    const ruleId = `FX_${threshold.id}`;
    const conditionMet = threshold.direction === 'below' ? index.value < threshold.threshold : index.value > threshold.threshold;
    const wasMet = await getRuleConditionMet(env.DB, threshold.symbol, ruleId);
    if (conditionMet !== wasMet) {
      await setRuleConditionMet(env.DB, threshold.symbol, ruleId, conditionMet);
    }
    if (!conditionMet || wasMet) continue;

    const key = `${threshold.symbol}:${ruleId}:${today}`;
    if (await isAlreadySent(env.DB, key)) continue;

    const action = `${threshold.label} ${threshold.threshold}원 ${threshold.direction === 'below' ? '이하' : '이상'} 진입`;
    await sendFxAlert(env.DISCORD_WEBHOOK_URL, threshold, ruleId, index.value);
    await Promise.all([
      markSent(env.DB, key),
      env.DB.prepare(`
        INSERT INTO gk_alert_log (symbol, rule_id, date, priority, status, action, indicators_json, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        threshold.symbol, ruleId, today, 'P1', 'CONFIRMED', action,
        JSON.stringify({ value: index.value, threshold: threshold.threshold }), new Date().toISOString(),
      ).run(),
    ]);
    sent++;
  }

  return { processed, sent };
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

    for (const alert of await evaluateRules(env.DB, snap, mode)) {
      const key = `${alert.symbol}:${alert.ruleId}:${today}`;
      if (await isAlreadySent(env.DB, key)) continue;
      await sendDiscordAlert(alert, snap, env.DISCORD_WEBHOOK_URL!);
      await Promise.all([markSent(env.DB, key), logAlert(env.DB, alert, today, snap)]);
      sent++;
    }
  }

  if (mode === 'daily') {
    const fx = await checkFxThresholds(env, today);
    processed += fx.processed;
    sent += fx.sent;
  }

  return { processed, sent };
}
