import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreateJudgmentDiaryEntry,
  JudgmentDiaryEntry,
  JudgmentDiaryListFilters,
  UpdateJudgmentDiaryEntry,
} from '@gokkan-keeper/shared';
import { toSafeLimit, transformJudgmentDiaryEntry } from '../mappers';

export class JudgmentDiaryRepository {
  constructor(private readonly db: D1Database) {}

  async getJudgmentDiaryEntries(filters: JudgmentDiaryListFilters = {}): Promise<JudgmentDiaryEntry[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.from) {
      conditions.push('date(created_at) >= date(?)');
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push('date(created_at) <= date(?)');
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

    const limit = toSafeLimit(filters.limit ?? 50, 50, 200);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db
      .prepare(`SELECT * FROM gk_judgment_diary_entries ${whereClause} ORDER BY created_at DESC LIMIT ?`)
      .bind(...values, limit)
      .all<any>();

    return (result.results || []).map(transformJudgmentDiaryEntry);
  }

  async getJudgmentDiaryEntryById(id: string): Promise<JudgmentDiaryEntry | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_judgment_diary_entries WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? transformJudgmentDiaryEntry(result) : null;
  }

  async createJudgmentDiaryEntry(data: CreateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;

    await this.db
      .prepare(`
        INSERT INTO gk_judgment_diary_entries (
          id, created_at, updated_at, title, summary, main_content, market_context, decision, action,
          assets_json, position_change_json, risk, invalidate_conditions_json, next_check,
          emotion_state, confidence, time_horizon, strategy_tags_json, refs_json,
          disclaimer_visible, reviewed_at, outcome, what_was_right, what_was_wrong, lesson, next_action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        createdAt,
        now,
        data.title,
        data.summary,
        data.mainContent,
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
        data.nextAction ?? null,
      )
      .run();

    const entry = await this.getJudgmentDiaryEntryById(id);
    if (!entry) throw new Error('Failed to create judgment diary entry');
    return entry;
  }

  async updateJudgmentDiaryEntry(id: string, data: UpdateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    const existing = await this.getJudgmentDiaryEntryById(id);
    if (!existing) throw new Error('Judgment diary entry not found');

    const updates: string[] = [];
    const values: any[] = [];

    const updateField = (field: string, value: any) => {
      updates.push(`${field} = ?`);
      values.push(value);
    };

    if (data.title !== undefined) updateField('title', data.title);
    if (data.summary !== undefined) updateField('summary', data.summary);
    if (data.mainContent !== undefined) updateField('main_content', data.mainContent);
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

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(new Date().toISOString(), id);

    await this.db
      .prepare(`UPDATE gk_judgment_diary_entries SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getJudgmentDiaryEntryById(id);
    if (!updated) throw new Error('Failed to update judgment diary entry');
    return updated;
  }
}
