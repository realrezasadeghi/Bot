import 'dotenv/config';

import { ConfigurationError, loadConfig } from '../config/env.js';
import { SyncRunStatus } from '../domain/academic/sync-run.js';
import { createAppContainer } from './container.js';
import { syncTerm, toUniversitySourceRequest } from './sync-term.js';

// --------------------------------------------------
// Bootstrap
// --------------------------------------------------

const config = loadConfig();
const container = createAppContainer(config);
const logger = container.logger.child({ component: 'worker' });

const startedAt = Date.now();

const SHUTDOWN_TIMEOUT_MS = 25_000;

// --------------------------------------------------
// Runtime State
// --------------------------------------------------

let stopping = false;
let shutdownPromise: Promise<void> | undefined;

const timers = new Set<NodeJS.Timeout>();

// Tracks all currently running asynchronous operations.
const activeTasks = new Set<Promise<void>>();

// Prevents overlapping execution of the same cycle.
const activeCycles = new Set<string>();

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

// --------------------------------------------------
// Academic Synchronization
// --------------------------------------------------

async function runSync(): Promise<void> {
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
				{ error: errorMessage(error) },
				'Academic sync cycle failed; previous data preserved',
			);
		}
	}
}

// --------------------------------------------------
// Notification Scheduling
// --------------------------------------------------

async function runScheduler(): Promise<void> {
	const results = await Promise.allSettled([
		container.scheduleClassReminders.execute(),
		container.scheduleExamReminders.execute(),
		container.generateDailySummaries.execute(),
	]);

	const errors = results.filter(
		(result): result is PromiseRejectedResult => result.status === 'rejected',
	);

	if (errors.length > 0) {
		logger.error(
			{
				errors: errors.map((result) => errorMessage(result.reason)),
			},
			'One or more notification scheduling tasks failed',
		);

		return;
	}

	const [remindersResult, examRemindersResult, summariesResult] = results;

	if (
		remindersResult.status !== 'fulfilled' ||
		examRemindersResult.status !== 'fulfilled' ||
		summariesResult.status !== 'fulfilled'
	) {
		return;
	}

	logger.info(
		{
			reminders: remindersResult.value,
			examReminders: examRemindersResult.value,
			summaries: summariesResult.value,
		},
		'Notification scheduling cycle completed',
	);
}

// --------------------------------------------------
// Notification Dispatch
// --------------------------------------------------

async function runDispatch(): Promise<void> {
	if (container.configuredPlatforms.size === 0) {
		logger.warn(
			{},
			'Notification dispatch skipped: no messaging platform configured',
		);

		return;
	}

	const result = await container.dispatchNotifications.execute();

	if (result.claimed > 0) {
		logger.info({ ...result }, 'Notification dispatch cycle completed');
	}
}

// --------------------------------------------------
// Cycle Execution
// --------------------------------------------------

async function runCycle(
	name: string,
	operation: () => Promise<void>,
): Promise<void> {
	if (stopping || activeCycles.has(name)) {
		return;
	}

	activeCycles.add(name);

	// Defer execution to a microtask so the task is registered
	// before its operation starts.
	const task = Promise.resolve().then(async () => {
		try {
			await operation();
		} catch (error) {
			logger.error(
				{
					cycle: name,
					error: errorMessage(error),
				},
				'Worker cycle failed',
			);
		} finally {
			activeCycles.delete(name);
		}
	});

	activeTasks.add(task);

	try {
		await task;
	} finally {
		activeTasks.delete(task);
	}
}

// --------------------------------------------------
// Recurring Scheduler
// --------------------------------------------------

function scheduleRecurringCycle(
	name: string,
	intervalMs: number,
	operation: () => Promise<void>,
): void {
	const scheduleNext = (): void => {
		if (stopping) {
			return;
		}

		const timer = setTimeout(() => {
			timers.delete(timer);

			if (stopping) {
				return;
			}

			// Schedule the next execution only after the
			// current cycle has completed.
			void runCycle(name, operation).then(scheduleNext, (error) => {
				logger.error(
					{
						cycle: name,
						error: errorMessage(error),
					},
					'Unexpected recurring cycle failure',
				);

				scheduleNext();
			});
		}, intervalMs);

		timers.add(timer);
	};

	scheduleNext();
}

// --------------------------------------------------
// Graceful Shutdown
// --------------------------------------------------

function shutdown(signal: string): Promise<void> {
	if (shutdownPromise) {
		return shutdownPromise;
	}

	stopping = true;

	logger.info({ signal }, 'Worker shutdown requested');

	// Stop all scheduled executions.
	for (const timer of timers) {
		clearTimeout(timer);
	}

	timers.clear();

	shutdownPromise = (async () => {
		const forceTimer = setTimeout(() => {
			logger.error(
				{
					timeoutMs: SHUTDOWN_TIMEOUT_MS,
					activeTasks: activeTasks.size,
				},
				'Worker shutdown timed out; forcing process termination',
			);

			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS);

		try {
			// Wait for all currently running operations.
			// No new cycles can start after stopping becomes true.
			await Promise.allSettled([...activeTasks]);

			logger.info({}, 'All active worker operations completed');

			// Close PostgreSQL only after active operations finish.
			await container.close();

			logger.info({}, 'Worker shutdown completed successfully');
		} catch (error) {
			process.exitCode = 1;

			logger.error({ error: errorMessage(error) }, 'Worker shutdown failed');
		} finally {
			clearTimeout(forceTimer);
		}
	})();

	return shutdownPromise;
}

// --------------------------------------------------
// Main
// --------------------------------------------------

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

	// Initial execution.
	await runCycle('sync', runSync);

	if (stopping) return;

	await runCycle('scheduler', runScheduler);

	if (stopping) return;

	await runCycle('dispatch', runDispatch);

	if (stopping) return;

	// Periodic heartbeat.
	scheduleRecurringCycle('heartbeat', 30_000, async () => {
		logger.info(
			{
				workerId: config.worker.id,
				uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
			},
			'Worker heartbeat',
		);
	});

	// Academic synchronization.
	scheduleRecurringCycle(
		'sync',
		config.scheduling.syncIntervalMinutes * 60_000,
		runSync,
	);

	// Notification scheduling.
	scheduleRecurringCycle(
		'scheduler',
		config.worker.schedulerIntervalMs,
		runScheduler,
	);

	// Notification dispatch.
	scheduleRecurringCycle('dispatch', config.worker.pollIntervalMs, runDispatch);

	logger.info({}, 'Worker started successfully');
}

// --------------------------------------------------
// Process Signals
// --------------------------------------------------

process.on('SIGINT', () => {
	void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
	void shutdown('SIGTERM');
});

// --------------------------------------------------
// Start Application
// --------------------------------------------------

main().catch(async (error: unknown) => {
	process.exitCode = 1;

	logger.error({ error: errorMessage(error) }, 'Worker failed to start');

	await shutdown('startup-error');
});
