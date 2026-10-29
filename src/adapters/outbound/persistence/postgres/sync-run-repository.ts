import { and, desc, eq } from 'drizzle-orm';
import type { SyncRunRepository } from '../../../../application/ports/outbound/sync-run-repository.js';
import type {
	SyncRun,
	SyncRunStats,
	SyncRunStatus,
} from '../../../../domain/academic/sync-run.js';
import type { AppDatabase } from './db.js';
import { toSyncRun } from './mappers.js';
import { syncRuns } from './schema.js';

export class PostgresSyncRunRepository implements SyncRunRepository {
	constructor(private readonly db: AppDatabase) {}

	async start(input: {
		id: string;
		sourceKey: string;
		startedAt: Date;
	}): Promise<SyncRun> {
		const [row] = await this.db
			.insert(syncRuns)
			.values({
				id: input.id,
				sourceKey: input.sourceKey,
				status: 'RUNNING',
				startedAt: input.startedAt,
			})
			.returning();
		if (!row) throw new Error('unreachable: insert should return a row');
		return toSyncRun(row);
	}

	async finish(input: {
		id: string;
		status: SyncRunStatus;
		finishedAt: Date;
		stats: SyncRunStats | null;
		errorSummary: string | null;
	}): Promise<void> {
		await this.db
			.update(syncRuns)
			.set({
				status: input.status,
				finishedAt: input.finishedAt,
				stats: input.stats ? { ...input.stats } : null,
				errorSummary: input.errorSummary,
			})
			.where(eq(syncRuns.id, input.id));
	}

	async findLatest(sourceKey: string): Promise<SyncRun | null> {
		const [row] = await this.db
			.select()
			.from(syncRuns)
			.where(eq(syncRuns.sourceKey, sourceKey))
			.orderBy(desc(syncRuns.startedAt))
			.limit(1);
		return row ? toSyncRun(row) : null;
	}

	async findLatestGood(sourceKey: string): Promise<SyncRun | null> {
		const [row] = await this.db
			.select()
			.from(syncRuns)
			.where(
				and(eq(syncRuns.sourceKey, sourceKey), eq(syncRuns.status, 'COMPLETED')),
			)
			.orderBy(desc(syncRuns.startedAt))
			.limit(1);
		return row ? toSyncRun(row) : null;
	}
}
