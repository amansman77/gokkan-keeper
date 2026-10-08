import { parseJSON } from '../mappers';
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

interface AlertLogRow {
  id: number;
  symbol: string;
  rule_id: string;
  date: string;
  priority: string;
  status: string;
  action: string | null;
  indicators_json: string | null;
  sent_at: string;
}

function transformAlertLogEntry(row: AlertLogRow): AlertLogEntry {
  const indicators = parseJSON(row.indicators_json, {
    safeParse(input: unknown) {
      if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
        return { success: true as const, data: input as Record<string, unknown> };
      }
      return { success: false as const };
    },
  }) ?? null;
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
      .all<AlertLogRow>();
    return (result.results || []).map(transformAlertLogEntry);
  }
}
