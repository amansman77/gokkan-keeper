import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreateGranary,
  CreateJudgmentDiaryEntry,
  CreatePosition,
  CreateSnapshot,
  Granary,
  JudgmentDiaryEntry,
  JudgmentDiaryListFilters,
  Position,
  PublicPortfolioResponse,
  Snapshot,
  UpdateGranary,
  UpdateJudgmentDiaryEntry,
  UpdatePosition,
  UpdateSnapshot,
} from '@gokkan-keeper/shared';
import type { Env } from '../types';
import { GranaryRepository } from './repositories/granary-repository';
import { JudgmentDiaryRepository } from './repositories/judgment-diary-repository';
import { PositionRepository } from './repositories/position-repository';
import { SnapshotRepository } from './repositories/snapshot-repository';

export class DBClient {
  private readonly granaries: GranaryRepository;
  private readonly snapshots: SnapshotRepository;
  private readonly positions: PositionRepository;
  private readonly judgmentDiary: JudgmentDiaryRepository;

  constructor(db: D1Database) {
    this.granaries = new GranaryRepository(db);
    this.snapshots = new SnapshotRepository(db);
    this.positions = new PositionRepository(db);
    this.judgmentDiary = new JudgmentDiaryRepository(db);
  }

  getAllGranaries(): Promise<Granary[]> {
    return this.granaries.getAllGranaries();
  }

  getAllGranariesWithLatestSnapshot(): Promise<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]> {
    return this.granaries.getAllGranariesWithLatestSnapshot();
  }

  getGranaryById(id: string): Promise<Granary | null> {
    return this.granaries.getGranaryById(id);
  }

  createGranary(data: CreateGranary): Promise<Granary> {
    return this.granaries.createGranary(data);
  }

  updateGranary(id: string, data: UpdateGranary): Promise<Granary> {
    return this.granaries.updateGranary(id, data);
  }

  getLatestSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    return this.snapshots.getLatestSnapshotByGranaryId(granaryId);
  }

  getPreviousSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    return this.snapshots.getPreviousSnapshotByGranaryId(granaryId);
  }

  getSnapshotsByGranaryId(granaryId: string, limit = 10): Promise<Snapshot[]> {
    return this.snapshots.getSnapshotsByGranaryId(granaryId, limit);
  }

  getAllSnapshots(limit = 50): Promise<Snapshot[]> {
    return this.snapshots.getAllSnapshots(limit);
  }

  getSnapshotById(id: string): Promise<Snapshot | null> {
    return this.snapshots.getSnapshotById(id);
  }

  createSnapshot(data: CreateSnapshot): Promise<Snapshot> {
    return this.snapshots.createSnapshot(data);
  }

  updateSnapshot(id: string, data: UpdateSnapshot): Promise<Snapshot> {
    return this.snapshots.updateSnapshot(id, data);
  }

  getOldestUnupdatedGranary(): Promise<{ granary: Granary; daysSinceUpdate: number } | null> {
    return this.granaries.getOldestUnupdatedGranary();
  }

  getPositions(granaryId?: string): Promise<Position[]> {
    return this.positions.getPositions(granaryId);
  }

  getPositionById(id: string): Promise<Position | null> {
    return this.positions.getPositionById(id);
  }

  createPosition(data: CreatePosition): Promise<Position> {
    return this.positions.createPosition(data);
  }

  updatePosition(id: string, data: UpdatePosition): Promise<Position> {
    return this.positions.updatePosition(id, data);
  }

  deletePosition(id: string): Promise<void> {
    return this.positions.deletePosition(id);
  }

  getPublicPortfolioEntries(env?: Env): Promise<PublicPortfolioResponse> {
    return this.positions.getPublicPortfolioEntries(env);
  }

  getJudgmentDiaryEntries(filters: JudgmentDiaryListFilters = {}): Promise<JudgmentDiaryEntry[]> {
    return this.judgmentDiary.getJudgmentDiaryEntries(filters);
  }

  getJudgmentDiaryEntryById(id: string): Promise<JudgmentDiaryEntry | null> {
    return this.judgmentDiary.getJudgmentDiaryEntryById(id);
  }

  createJudgmentDiaryEntry(data: CreateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    return this.judgmentDiary.createJudgmentDiaryEntry(data);
  }

  updateJudgmentDiaryEntry(id: string, data: UpdateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    return this.judgmentDiary.updateJudgmentDiaryEntry(id, data);
  }
}
