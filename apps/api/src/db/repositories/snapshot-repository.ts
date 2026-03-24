import type { D1Database } from '@cloudflare/workers-types';
import type { CreateSnapshot, Snapshot, UpdateSnapshot } from '@gokkan-keeper/shared';
import { toSafeLimit, transformSnapshot } from '../mappers';

export class SnapshotRepository {
  constructor(private readonly db: D1Database) {}

  async getLatestSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT 1')
      .bind(granaryId)
      .first<any>();
    return result ? transformSnapshot(result) : null;
  }

  async getPreviousSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT 1 OFFSET 1')
      .bind(granaryId)
      .first<any>();
    return result ? transformSnapshot(result) : null;
  }

  async getSnapshotsByGranaryId(granaryId: string, limit = 10): Promise<Snapshot[]> {
    const safeLimit = toSafeLimit(limit, 10, 200);
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT ?')
      .bind(granaryId, safeLimit)
      .all<any>();
    return (result.results || []).map(transformSnapshot);
  }

  async getAllSnapshots(limit = 50): Promise<Snapshot[]> {
    const safeLimit = toSafeLimit(limit, 50, 200);
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots ORDER BY date DESC LIMIT ?')
      .bind(safeLimit)
      .all<any>();
    return (result.results || []).map(transformSnapshot);
  }

  async getSnapshotById(id: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? transformSnapshot(result) : null;
  }

  async createSnapshot(data: CreateSnapshot): Promise<Snapshot> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await this.db
        .prepare('INSERT INTO gk_snapshots (id, granary_id, date, total_amount, available_balance, profit_loss, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(
          id,
          data.granaryId,
          data.date,
          data.totalAmount,
          data.availableBalance ?? null,
          data.profitLoss ?? null,
          data.memo ?? null,
          now,
        )
        .run();
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        throw new Error('Snapshot already exists for this granary and date');
      }
      throw error;
    }

    const snapshot = await this.getSnapshotById(id);
    if (!snapshot) throw new Error('Failed to create snapshot');
    return snapshot;
  }

  async updateSnapshot(id: string, data: UpdateSnapshot): Promise<Snapshot> {
    const existing = await this.getSnapshotById(id);
    if (!existing) throw new Error('Snapshot not found');

    const updates: string[] = [];
    const values: any[] = [];

    if (data.date !== undefined) {
      updates.push('date = ?');
      values.push(data.date);
    }
    if (data.totalAmount !== undefined) {
      updates.push('total_amount = ?');
      values.push(data.totalAmount);
    }
    if (data.availableBalance !== undefined) {
      updates.push('available_balance = ?');
      values.push(data.availableBalance ?? null);
    }
    if (data.profitLoss !== undefined) {
      updates.push('profit_loss = ?');
      values.push(data.profitLoss ?? null);
    }
    if (data.memo !== undefined) {
      updates.push('memo = ?');
      values.push(data.memo ?? null);
    }
    if (updates.length === 0) return existing;

    values.push(id);

    await this.db
      .prepare(`UPDATE gk_snapshots SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getSnapshotById(id);
    if (!updated) throw new Error('Failed to update snapshot');
    return updated;
  }
}
