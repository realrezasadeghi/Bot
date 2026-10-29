import 'dotenv/config';
import { ConfigurationError, loadConfig } from '../config/env.js';
import { SyncRunStatus } from '../domain/academic/sync-run.js';
import type { AppContainer } from './container.js';
import { createAppContainer } from './container.js';
import { syncTerm, toUniversitySourceRequest } from './sync-term.js';

const config = loadConfig();
const container = createAppContainer(config);
const logger = container.logger.child({ component: 'worker' });

let stopping = false;
let syncRunning = false;
let schedulerRunning = false;
let dispatchRunning = false;
const timers = new Set<NodeJS.Timeout>();

async function runSync(container: AppContainer): Promise<void> {
	if (syncRunning || stopping) return;
	syncRunning = true;
	try {
		const result = await syncTerm(
			container,
			toUniversitySourceRequest(config.university),
		);

		const sync = result.synchronization;
		if (sync.status === SyncRunStatus.Rejected) {
			logger.warn(
				{
					syncRunId: sync.syncRunId,
					status: sync.status,
					complete: sync.complete,
					warnings: sync.warnings.length,
					errorSummary: 'Snapshot rejected: invalid or unexpectedly reduced data',
				},
				'Academic sync rejected; last known good data preserved',
			);
			return;
		}

		logger.info(
			{
				syncRunId: sync.syncRunId,
				status: sync.status,
				termId: result.termId,
				complete: result.snapshot.complete,
				reconcileAbsent: sync.reconcileAbsent,
				occurrences: result.occurrences
					? {
							created: result.occurrences.created,
							updated: result.occurrences.updated,
							cancelled: result.occurrences.cancelled,
						}
					: null,
				stats: sync.stats,
			},
			'Academic sync cycle completed',
		);
	} catch (error) {
		if (error instanceof ConfigurationError) {
			logger.warn({ error: error.message }, 'Academic sync skipped');
		} else {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
				},
				'Academic sync cycle failed; previous data preserved',
			);
		}
	} finally {
		syncRunning = false;
	}
}

async function runScheduler(container: AppContainer): Promise<void> {
	if (schedulerRunning || stopping) return;
	schedulerRunning = true;
	try {
		const [reminders, examReminders, summaries] = await Promise.all([
			container.scheduleClassReminders.execute(),
			container.scheduleExamReminders.execute(),
			container.generateDailySummaries.execute(),
		]);
		logger.info(
			{ reminders, examReminders, summaries },
			'Notification scheduling cycle completed',
		);
	} catch (error) {
		logger.error(
			{ error: error instanceof Error ? error.message : String(error) },
			'Notification scheduling cycle failed',
		);
	} finally {
		schedulerRunning = false;
	}
}

async function runDispatch(container: AppContainer): Promise<void> {
	if (dispatchRunning || stopping) return;
	if (container.configuredPlatforms.size === 0) {
		logger.warn(
			{},
			'Notification dispatch skipped: no messaging platform configured',
		);
		return;
	}
	dispatchRunning = true;
	try {
		const result = await container.dispatchNotifications.execute();
		if (result.claimed > 0) {
			logger.info({ ...result }, 'Notification dispatch cycle completed');
		}
	} catch (error) {
		logger.error(
			{ error: error instanceof Error ? error.message : String(error) },
			'Notification dispatch cycle failed',
		);
	} finally {
		dispatchRunning = false;
	}
}

function every(
	name: string,
	intervalMs: number,
	work: () => Promise<void>,
): void {
	const tick = async (): Promise<void> => {
		if (stopping) return;
		try {
			await work();
		} catch (error) {
			logger.error(
				{
					cycle: name,
					error: error instanceof Error ? error.message : String(error),
				},
				'Worker cycle failed',
			);
		}
		if (!stopping) {
			const timer = setTimeout(() => {
				void tick();
			}, intervalMs);
			timers.add(timer);
		}
	};
	void tick();
}

const startedAt = Date.now();
async function main(): Promise<void> {
	logger.info(
		{
			workerId: config.worker.id,
			platforms: [...container.configuredPlatforms],
			pollIntervalMs: config.worker.pollIntervalMs,
			schedulerIntervalMs: config.worker.schedulerIntervalMs,
		},
		'Worker starting',
	);

	await runSync(container);
	await runScheduler(container);
	await runDispatch(container);

	every('heartbeat', 30_000, async () => {
		logger.info(
			{
				workerId: config.worker.id,
				uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
			},
			'Worker heartbeat',
		);
	});

	every('sync', config.scheduling.syncIntervalMinutes * 60_000, () =>
		runSync(container),
	);
	every('scheduler', config.worker.schedulerIntervalMs, () =>
		runScheduler(container),
	);
	every('dispatch', config.worker.pollIntervalMs, () => runDispatch(container));
}

async function shutdown(signal: string): Promise<void> {
	if (stopping) return;
	stopping = true;
	logger.info({ signal }, 'Worker shutting down');
	for (const timer of timers) clearTimeout(timer);
	timers.clear();
	await container.close();
	process.exit(0);
}

process.on('SIGINT', () => {
	void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
	void shutdown('SIGTERM');
});

main().catch(async (error) => {
	logger.error(
		{ error: error instanceof Error ? error.message : String(error) },
		'Worker failed to start',
	);
	await container.close();
	process.exit(1);
});
