import type { D1Database } from '@cloudflare/workers-types';
import type { AlertThreshold, CreateAlertThreshold, UpdateAlertThreshold } from '@gokkan-keeper/shared';

function transformAlertThreshold(row: any): AlertThreshold {
  return {
    id: row.id,
    symbol: row.symbol,
    label: row.label,
    direction: row.direction,
    threshold: row.threshold,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AlertThresholdRepository {
  constructor(private readonly db: D1Database) {}

  async getAlertThresholds(): Promise<AlertThreshold[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_alert_thresholds ORDER BY created_at DESC')
      .all<any>();
    return (result.results || []).map(transformAlertThreshold);
  }

  async getEnabledAlertThresholds(): Promise<AlertThreshold[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_alert_thresholds WHERE enabled = 1')
      .all<any>();
    return (result.results || []).map(transformAlertThreshold);
  }

  async createAlertThreshold(data: CreateAlertThreshold): Promise<AlertThreshold> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO gk_alert_thresholds (id, symbol, label, direction, threshold, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, data.symbol, data.label, data.direction, data.threshold, data.enabled ? 1 : 0, now, now)
      .run();

    const created = await this.getAlertThresholdById(id);
    if (!created) throw new Error('Failed to create alert threshold');
    return created;
  }

  async getAlertThresholdById(id: string): Promise<AlertThreshold | null> {
    const row = await this.db.prepare('SELECT * FROM gk_alert_thresholds WHERE id = ?').bind(id).first<any>();
    return row ? transformAlertThreshold(row) : null;
  }

  async updateAlertThreshold(id: string, data: UpdateAlertThreshold): Promise<AlertThreshold> {
    const existing = await this.getAlertThresholdById(id);
    if (!existing) throw new Error('Alert threshold not found');

    const updates: string[] = [];
    const values: any[] = [];
    const set = (field: string, value: any) => { updates.push(`${field} = ?`); values.push(value); };

    if (data.symbol !== undefined) set('symbol', data.symbol);
    if (data.label !== undefined) set('label', data.label);
    if (data.direction !== undefined) set('direction', data.direction);
    if (data.threshold !== undefined) set('threshold', data.threshold);
    if (data.enabled !== undefined) set('enabled', data.enabled ? 1 : 0);

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(new Date().toISOString(), id);

    await this.db.prepare(`UPDATE gk_alert_thresholds SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await this.getAlertThresholdById(id);
    if (!updated) throw new Error('Failed to update alert threshold');
    return updated;
  }

  async deleteAlertThreshold(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM gk_alert_thresholds WHERE id = ?').bind(id).run();
  }
}
