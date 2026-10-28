import 'dotenv/config';
import { ConfigurationError, loadConfig } from '../config/env.js';
import type { AppContainer } from './container.js';
import { createAppContainer } from './container.js';
import { syncTerm } from './sync-term.js';

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
		const result = await syncTerm(container, config.university.termCode);
		logger.info(
			{
				termId: result.termId,
				complete: result.snapshot.complete,
				occurrences: result.occurrences,
				syncRunId: result.synchronization.syncRunId,
			},
			'Academic sync cycle completed',
		);
	} catch (error) {
		if (error instanceof ConfigurationError) {
			logger.warn({ error: error.message }, 'Academic sync skipped');
		} else {
			logger.error(
				{ error: error instanceof Error ? error.message : String(error) },
				'Academic sync cycle failed',
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
