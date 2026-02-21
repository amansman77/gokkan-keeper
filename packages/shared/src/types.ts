// Import types from schemas.ts
import type { Granary, Snapshot, JudgmentDiaryEntry } from './schemas';

// Re-export types from schemas.ts
export type {
  Granary,
  Snapshot,
  CreateGranary,
  CreateSnapshot,
  UpdateGranary,
  UpdateSnapshot,
  JudgmentDiaryEntry,
  CreateJudgmentDiaryEntry,
  UpdateJudgmentDiaryEntry,
  JudgmentDiaryAsset,
  JudgmentDiaryPositionChange,
  JudgmentDiaryRef,
  PublicPortfolioEntry,
  PublicPortfolioWarning,
  PublicPortfolioResponse,
  ConsultingRequest,
  ConsultingRequestResult,
  Position,
  CreatePosition,
  UpdatePosition,
} from './schemas';

export interface GranaryWithLatestSnapshot extends Granary {
  latestSnapshot?: Snapshot;
  previousSnapshot?: Snapshot;
}

export interface StatusSummary {
  totalGranaries: number;
  totalSnapshots: number;
  oldestUnupdatedGranary?: {
    granary: Granary;
    daysSinceUpdate: number;
  };
  recentSnapshots: Snapshot[];
}

export interface JudgmentDiaryListFilters {
  from?: string;
  to?: string;
  action?: JudgmentDiaryEntry['action'];
  asset?: string;
  strategyTag?: string;
  limit?: number;
}
