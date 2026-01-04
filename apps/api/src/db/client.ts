import type { D1Database } from '@cloudflare/workers-types';
import type { Granary, Snapshot, CreateGranary, CreateSnapshot, UpdateGranary, UpdateSnapshot } from '@gokkan-keeper/shared';

export class DBClient {
  constructor(private db: D1Database) {}

  async getAllGranaries(): Promise<Granary[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_granaries ORDER BY created_at DESC')
      .all<any>();
    return (result.results || []).map(this.transformGranary);
  }

  async getAllGranariesWithLatestSnapshot(): Promise<(Granary & { latestSnapshot?: Snapshot })[]> {
    const granaries = await this.getAllGranaries();
    const granariesWithSnapshots = await Promise.all(
      granaries.map(async (granary) => {
        const latestSnapshot = await this.getLatestSnapshotByGranaryId(granary.id);
        return {
          ...granary,
          latestSnapshot: latestSnapshot || undefined,
        };
      })
    );
    return granariesWithSnapshots;
  }

  private transformGranary(row: any): Granary {
    return {
      id: row.id,
      name: row.name,
      purpose: row.purpose,
      currency: row.currency,
      owner: row.owner,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getGranaryById(id: string): Promise<Granary | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_granaries WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? this.transformGranary(result) : null;
  }

  async createGranary(data: CreateGranary): Promise<Granary> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.db
      .prepare(
        'INSERT INTO gk_granaries (id, name, purpose, currency, owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, data.name, data.purpose, data.currency, data.owner || 'default', now, now)
      .run();

    const granary = await this.getGranaryById(id);
    if (!granary) {
      throw new Error('Failed to create granary');
    }
    return granary;
  }

  async updateGranary(id: string, data: UpdateGranary): Promise<Granary> {
    // Get existing granary
    const existing = await this.getGranaryById(id);
    if (!existing) {
      throw new Error('Granary not found');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.purpose !== undefined) {
      updates.push('purpose = ?');
      values.push(data.purpose);
    }
    if (data.currency !== undefined) {
      updates.push('currency = ?');
      values.push(data.currency);
    }

    if (updates.length === 0) {
      return existing;
    }

    // Always update updated_at
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE gk_granaries SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getGranaryById(id);
    if (!updated) {
      throw new Error('Failed to update granary');
    }
    return updated;
  }

  async getLatestSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT 1')
      .bind(granaryId)
      .first<any>();
    return result ? this.transformSnapshot(result) : null;
  }

  async getSnapshotsByGranaryId(granaryId: string, limit = 10): Promise<Snapshot[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT ?')
      .bind(granaryId, limit)
      .all<any>();
    return (result.results || []).map(this.transformSnapshot);
  }

  async getAllSnapshots(limit = 50): Promise<Snapshot[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots ORDER BY date DESC LIMIT ?')
      .bind(limit)
      .all<any>();
    return (result.results || []).map(this.transformSnapshot);
  }

  private transformSnapshot(row: any): Snapshot {
    return {
      id: row.id,
      granaryId: row.granary_id,
      date: row.date,
      totalAmount: row.total_amount,
      availableBalance: row.available_balance,
      memo: row.memo,
      createdAt: row.created_at,
    };
  }

  async createSnapshot(data: CreateSnapshot): Promise<Snapshot> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await this.db
        .prepare(
          'INSERT INTO gk_snapshots (id, granary_id, date, total_amount, available_balance, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          data.granaryId,
          data.date,
          data.totalAmount,
          data.availableBalance ?? null,
          data.memo ?? null,
          now
        )
        .run();
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        throw new Error('Snapshot already exists for this granary and date');
      }
      throw error;
    }

    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE id = ?')
      .bind(id)
      .first<any>();

    if (!result) {
      throw new Error('Failed to create snapshot');
    }
    return this.transformSnapshot(result);
  }

  async getSnapshotById(id: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? this.transformSnapshot(result) : null;
  }

  async updateSnapshot(id: string, data: UpdateSnapshot): Promise<Snapshot> {
    // Get existing snapshot
    const existing = await this.getSnapshotById(id);
    if (!existing) {
      throw new Error('Snapshot not found');
    }

    // Build update query dynamically
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
    if (data.memo !== undefined) {
      updates.push('memo = ?');
      values.push(data.memo ?? null);
    }

    if (updates.length === 0) {
      return existing;
    }

    values.push(id);

    await this.db
      .prepare(`UPDATE gk_snapshots SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getSnapshotById(id);
    if (!updated) {
      throw new Error('Failed to update snapshot');
    }
    return updated;
  }

  async getOldestUnupdatedGranary(): Promise<{ granary: Granary; daysSinceUpdate: number } | null> {
    const result = await this.db
      .prepare(`
        SELECT g.*, 
               MAX(s.date) as last_snapshot_date
        FROM gk_granaries g
        LEFT JOIN gk_snapshots s ON g.id = s.granary_id
        GROUP BY g.id
        ORDER BY last_snapshot_date ASC NULLS FIRST
        LIMIT 1
      `)
      .first<any>();

    if (!result) {
      return null;
    }

    const lastDate = result.last_snapshot_date || result.created_at;
    const daysSince = Math.floor(
      (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const granary = this.transformGranary(result);
    return { granary, daysSinceUpdate: daysSince };
  }
}

