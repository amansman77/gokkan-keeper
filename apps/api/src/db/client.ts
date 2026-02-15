import type { D1Database } from '@cloudflare/workers-types';
import type {
  Granary,
  Snapshot,
  CreateGranary,
  CreateSnapshot,
  UpdateGranary,
  UpdateSnapshot,
  JudgmentDiaryEntry,
  CreateJudgmentDiaryEntry,
  UpdateJudgmentDiaryEntry,
  JudgmentDiaryListFilters,
} from '@gokkan-keeper/shared';

export class DBClient {
  constructor(private db: D1Database) {}

  async getAllGranaries(): Promise<Granary[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_granaries ORDER BY created_at DESC')
      .all<any>();
    return (result.results || []).map(this.transformGranary);
  }

  async getAllGranariesWithLatestSnapshot(): Promise<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]> {
    const granaries = await this.getAllGranaries();
    const granariesWithSnapshots = await Promise.all(
      granaries.map(async (granary) => {
        const [latestSnapshot, previousSnapshot] = await Promise.all([
          this.getLatestSnapshotByGranaryId(granary.id),
          this.getPreviousSnapshotByGranaryId(granary.id),
        ]);
        return {
          ...granary,
          latestSnapshot: latestSnapshot || undefined,
          previousSnapshot: previousSnapshot || undefined,
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

  async getPreviousSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT 1 OFFSET 1')
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
      profitLoss: row.profit_loss,
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
          'INSERT INTO gk_snapshots (id, granary_id, date, total_amount, available_balance, profit_loss, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          data.granaryId,
          data.date,
          data.totalAmount,
          data.availableBalance ?? null,
          data.profitLoss ?? null,
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
    if (data.profitLoss !== undefined) {
      updates.push('profit_loss = ?');
      values.push(data.profitLoss ?? null);
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

  private parseJSON<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private transformJudgmentDiaryEntry(row: any): JudgmentDiaryEntry {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      title: row.title,
      summary: row.summary,
      marketContext: row.market_context ?? null,
      decision: row.decision ?? null,
      action: row.action,
      assets: this.parseJSON(row.assets_json, undefined as any),
      positionChange: this.parseJSON(row.position_change_json, undefined as any),
      risk: row.risk ?? null,
      invalidateConditions: this.parseJSON(row.invalidate_conditions_json, undefined as any),
      nextCheck: row.next_check,
      emotionState: row.emotion_state,
      confidence: row.confidence,
      timeHorizon: row.time_horizon,
      strategyTags: this.parseJSON(row.strategy_tags_json, undefined as any),
      refs: this.parseJSON(row.refs_json, undefined as any),
      disclaimerVisible: row.disclaimer_visible === 1,
      reviewedAt: row.reviewed_at,
      outcome: row.outcome,
      whatWasRight: row.what_was_right,
      whatWasWrong: row.what_was_wrong,
      lesson: row.lesson,
      nextAction: row.next_action,
    };
  }

  async getJudgmentDiaryEntries(filters: JudgmentDiaryListFilters = {}): Promise<JudgmentDiaryEntry[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.from) {
      conditions.push("date(created_at) >= date(?)");
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push("date(created_at) <= date(?)");
      values.push(filters.to);
    }
    if (filters.action) {
      conditions.push('action = ?');
      values.push(filters.action);
    }
    if (filters.asset) {
      conditions.push('assets_json LIKE ?');
      values.push(`%${filters.asset}%`);
    }
    if (filters.strategyTag) {
      conditions.push('strategy_tags_json LIKE ?');
      values.push(`%${filters.strategyTag}%`);
    }

    const limit = filters.limit ?? 50;
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db
      .prepare(`SELECT * FROM gk_judgment_diary_entries ${whereClause} ORDER BY created_at DESC LIMIT ?`)
      .bind(...values, limit)
      .all<any>();

    return (result.results || []).map((row) => this.transformJudgmentDiaryEntry(row));
  }

  async getJudgmentDiaryEntryById(id: string): Promise<JudgmentDiaryEntry | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_judgment_diary_entries WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? this.transformJudgmentDiaryEntry(result) : null;
  }

  async createJudgmentDiaryEntry(data: CreateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;

    await this.db
      .prepare(
        `INSERT INTO gk_judgment_diary_entries (
          id, created_at, updated_at, title, summary, market_context, decision, action,
          assets_json, position_change_json, risk, invalidate_conditions_json, next_check,
          emotion_state, confidence, time_horizon, strategy_tags_json, refs_json,
          disclaimer_visible, reviewed_at, outcome, what_was_right, what_was_wrong, lesson, next_action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        createdAt,
        now,
        data.title,
        data.summary,
        data.marketContext ?? null,
        data.decision ?? null,
        data.action,
        JSON.stringify(data.assets ?? []),
        JSON.stringify(data.positionChange ?? []),
        data.risk ?? null,
        JSON.stringify(data.invalidateConditions ?? []),
        data.nextCheck ?? null,
        data.emotionState ?? null,
        data.confidence ?? null,
        data.timeHorizon ?? null,
        data.strategyTags ? JSON.stringify(data.strategyTags) : null,
        data.refs ? JSON.stringify(data.refs) : null,
        data.disclaimerVisible ? 1 : 0,
        data.reviewedAt ?? null,
        data.outcome ?? null,
        data.whatWasRight ?? null,
        data.whatWasWrong ?? null,
        data.lesson ?? null,
        data.nextAction ?? null
      )
      .run();

    const entry = await this.getJudgmentDiaryEntryById(id);
    if (!entry) {
      throw new Error('Failed to create judgment diary entry');
    }
    return entry;
  }

  async updateJudgmentDiaryEntry(id: string, data: UpdateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    const existing = await this.getJudgmentDiaryEntryById(id);
    if (!existing) {
      throw new Error('Judgment diary entry not found');
    }

    const updates: string[] = [];
    const values: any[] = [];

    const updateField = (field: string, value: any) => {
      updates.push(`${field} = ?`);
      values.push(value);
    };

    if (data.title !== undefined) updateField('title', data.title);
    if (data.summary !== undefined) updateField('summary', data.summary);
    if (data.marketContext !== undefined) updateField('market_context', data.marketContext ?? null);
    if (data.decision !== undefined) updateField('decision', data.decision ?? null);
    if (data.action !== undefined) updateField('action', data.action);
    if (data.assets !== undefined) updateField('assets_json', JSON.stringify(data.assets ?? []));
    if (data.positionChange !== undefined) updateField('position_change_json', JSON.stringify(data.positionChange ?? []));
    if (data.risk !== undefined) updateField('risk', data.risk ?? null);
    if (data.invalidateConditions !== undefined) updateField('invalidate_conditions_json', JSON.stringify(data.invalidateConditions ?? []));
    if (data.nextCheck !== undefined) updateField('next_check', data.nextCheck ?? null);
    if (data.emotionState !== undefined) updateField('emotion_state', data.emotionState ?? null);
    if (data.confidence !== undefined) updateField('confidence', data.confidence ?? null);
    if (data.timeHorizon !== undefined) updateField('time_horizon', data.timeHorizon ?? null);
    if (data.strategyTags !== undefined) updateField('strategy_tags_json', data.strategyTags ? JSON.stringify(data.strategyTags) : null);
    if (data.refs !== undefined) updateField('refs_json', data.refs ? JSON.stringify(data.refs) : null);
    if (data.disclaimerVisible !== undefined) updateField('disclaimer_visible', data.disclaimerVisible ? 1 : 0);
    if (data.reviewedAt !== undefined) updateField('reviewed_at', data.reviewedAt ?? null);
    if (data.outcome !== undefined) updateField('outcome', data.outcome ?? null);
    if (data.whatWasRight !== undefined) updateField('what_was_right', data.whatWasRight ?? null);
    if (data.whatWasWrong !== undefined) updateField('what_was_wrong', data.whatWasWrong ?? null);
    if (data.lesson !== undefined) updateField('lesson', data.lesson ?? null);
    if (data.nextAction !== undefined) updateField('next_action', data.nextAction ?? null);

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE gk_judgment_diary_entries SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getJudgmentDiaryEntryById(id);
    if (!updated) {
      throw new Error('Failed to update judgment diary entry');
    }
    return updated;
  }
}
