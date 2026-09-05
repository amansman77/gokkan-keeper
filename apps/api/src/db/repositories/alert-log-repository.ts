import type { D1Database } from '@cloudflare/workers-types';

export interface AlertLogEntry {
  id: number;
  symbol: string;
  ruleId: string;
  date: string;
  priority: string;
  status: string;
  action: string | null;
  indicators: Record<string, unknown> | null;
  sentAt: string;
}

function transformAlertLogEntry(row: any): AlertLogEntry {
  let indicators: Record<string, unknown> | null = null;
  if (row.indicators_json) {
    try { indicators = JSON.parse(row.indicators_json); } catch { indicators = null; }
  }
  return {
    id: row.id,
    symbol: row.symbol,
    ruleId: row.rule_id,
    date: row.date,
    priority: row.priority,
    status: row.status,
    action: row.action ?? null,
    indicators,
    sentAt: row.sent_at,
  };
}

export class AlertLogRepository {
  constructor(private readonly db: D1Database) {}

  async getAlertLog(limit: number): Promise<AlertLogEntry[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_alert_log ORDER BY sent_at DESC LIMIT ?')
      .bind(limit)
      .all<any>();
    return (result.results || []).map(transformAlertLogEntry);
  }
}
