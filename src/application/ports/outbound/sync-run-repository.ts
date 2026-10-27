import type {
  SyncRun,
  SyncRunStats,
  SyncRunStatus,
} from "../../../domain/academic/sync-run.js";

export interface SyncRunRepository {
  start(input: { id: string; sourceKey: string; startedAt: Date }): Promise<SyncRun>;
  finish(input: {
    id: string;
    status: SyncRunStatus;
    finishedAt: Date;
    stats: SyncRunStats | null;
    errorSummary: string | null;
  }): Promise<void>;
  findLatest(sourceKey: string): Promise<SyncRun | null>;
}
