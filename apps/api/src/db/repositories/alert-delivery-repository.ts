import type { D1Database } from '@cloudflare/workers-types';

export interface PendingAlert {
  symbol: string; ruleId: string; date: string; priority: string; status: string;
  action: string; indicators: unknown; payload: unknown;
}
interface DeliveryRow {
  alert_key: string; payload_json: string; attempts: number;
}

export class AlertDeliveryRepository {
  constructor(private readonly db: D1Database) {}

  /** INSERT sees the old state; the following UPSERT commits in the same D1 batch. */
  async transition(symbol: string, ruleId: string, met: boolean, alert?: PendingAlert): Promise<void> {
    const now = new Date().toISOString();
    const statements = [];
    if (met && alert) {
      const key = `${symbol}:${ruleId}:${alert.date}`;
      statements.push(this.db.prepare(`
        INSERT INTO gk_alert_outbox
          (alert_key, symbol, rule_id, date, priority, status, action, indicators_json, payload_json, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM gk_alert_rule_state WHERE symbol = ? AND rule_id = ? AND condition_met = 1)
          AND NOT EXISTS (SELECT 1 FROM gk_alert_sent WHERE alert_key = ?)
        ON CONFLICT(alert_key) DO NOTHING
      `).bind(key, symbol, ruleId, alert.date, alert.priority, alert.status, alert.action,
        JSON.stringify(alert.indicators), JSON.stringify(alert.payload), now, symbol, ruleId, key));
    }
    statements.push(this.db.prepare(`
      INSERT INTO gk_alert_rule_state (symbol, rule_id, condition_met, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(symbol, rule_id) DO UPDATE SET condition_met = excluded.condition_met, updated_at = excluded.updated_at
      WHERE gk_alert_rule_state.condition_met != excluded.condition_met
    `).bind(symbol, ruleId, met ? 1 : 0, now));
    await this.db.batch(statements);
  }

  /** A bounded lease excludes concurrent senders and expires after worker failure. */
  async deliver(webhook: string, send: typeof fetch = fetch, now?: number): Promise<number> {
    const clock = () => now ?? Math.floor(Date.now() / 1000);
    const candidates = await this.db.prepare(`SELECT alert_key FROM gk_alert_outbox
      WHERE delivered_at IS NULL AND next_attempt_at <= ? AND lease_until <= ?
      ORDER BY created_at, alert_key LIMIT 50`).bind(clock(), clock()).all<{ alert_key: string }>();
    let sent = 0;
    for (const candidate of candidates.results ?? []) {
      const current = clock();
      const token = crypto.randomUUID();
      const row = await this.db.prepare(`UPDATE gk_alert_outbox SET lease_token = ?, lease_until = ?, attempts = attempts + 1
        WHERE alert_key = ? AND delivered_at IS NULL AND next_attempt_at <= ? AND lease_until <= ?
        RETURNING alert_key, payload_json, attempts`).bind(token, current + 120, candidate.alert_key, current, current).first<DeliveryRow>();
      if (!row) continue;
      try {
        const response = await send(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: row.payload_json, signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
        const deliveredAt = new Date().toISOString();
        const results = await this.db.batch([
          this.db.prepare(`INSERT OR IGNORE INTO gk_alert_sent (alert_key, sent_at)
            SELECT alert_key, ? FROM gk_alert_outbox WHERE alert_key = ? AND lease_token = ? AND delivered_at IS NULL`)
            .bind(deliveredAt, row.alert_key, token),
          this.db.prepare(`INSERT INTO gk_alert_log (symbol, rule_id, date, priority, status, action, indicators_json, sent_at)
            SELECT symbol, rule_id, date, priority, status, action, indicators_json, ? FROM gk_alert_outbox
            WHERE alert_key = ? AND lease_token = ? AND delivered_at IS NULL`).bind(deliveredAt, row.alert_key, token),
          this.db.prepare(`UPDATE gk_alert_outbox SET delivered_at = ?, lease_token = NULL, lease_until = 0, last_error = NULL
            WHERE alert_key = ? AND lease_token = ? AND delivered_at IS NULL`).bind(deliveredAt, row.alert_key, token),
        ]);
        if ((results.at(-1)?.meta.changes ?? 0) > 0) sent++;
      } catch (error) {
        // Never persist webhook URLs, response bodies or arbitrary network exception messages.
        const reason = error instanceof Error && /^Discord HTTP \d{3}$/.test(error.message) ? error.message : 'delivery_failed';
        await this.db.prepare(`UPDATE gk_alert_outbox SET lease_token = NULL, lease_until = 0, next_attempt_at = ?, last_error = ?
          WHERE alert_key = ? AND lease_token = ? AND delivered_at IS NULL`)
          .bind(clock() + Math.min(3600, 60 * 2 ** Math.min(row.attempts - 1, 6)), reason, row.alert_key, token).run();
      }
    }
    return sent;
  }
}
