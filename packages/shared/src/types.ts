// Import types from schemas.ts
import type { Granary, Snapshot } from './schemas';

// Re-export types from schemas.ts
export type { Granary, Snapshot, CreateGranary, CreateSnapshot } from './schemas';

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

