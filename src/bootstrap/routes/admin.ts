import type { Request, Response } from 'express';
import { LocalDate } from '../../domain/shared/local-date.js';
import type { AppContainer } from '../container.js';
import { syncTerm } from '../sync-term.js';
import { bodyOf, optionalString } from './helpers.js';

/**
 * Admin routes for academic synchronization, occurrence generation,
 * notification scheduling, and sync-run inspection.
 *
 * All routes are protected by the admin auth middleware.
 */
export function createAdminRoutes(container: AppContainer) {
	return {
		/**
		 * POST /sync - Synchronize academic data for a term.
		 */
		sync: async (request: Request, response: Response): Promise<void> => {
			const body = bodyOf(request);
			const termCode =
				optionalString(body.termCode) ?? container.config.university.termCode;
			const result = await syncTerm(container, termCode);
			response.status(200).json({
				synchronization: result.synchronization,
				termId: result.termId,
				occurrences: result.occurrences,
				warnings: result.snapshot.warnings,
				complete: result.snapshot.complete,
			});
		},

		/**
		 * POST /occurrences - Generate class occurrences for a term.
		 */
		occurrences: async (request: Request, response: Response): Promise<void> => {
			const body = bodyOf(request);
			const termId = optionalString(body.termId);
			if (!termId) {
				response.status(400).json({
					error: { code: 'VALIDATION_ERROR', message: 'termId is required' },
				});
				return;
			}

			const from = optionalString(body.from);
			const to = optionalString(body.to);
			const result = await container.generateClassOccurrences.execute({
				termId,
				from: from ? LocalDate.parse(from) : undefined,
				to: to ? LocalDate.parse(to) : undefined,
				reconcileAbsent: body.reconcileAbsent === true,
			});
			response.status(200).json(result);
		},

		/**
		 * POST /notifications/schedule - Schedule reminders and summaries.
		 */
		scheduleNotifications: async (
			request: Request,
			response: Response,
		): Promise<void> => {
			const body = bodyOf(request);
			const userId = optionalString(body.userId);
			const [reminders, summaries] = await Promise.all([
				container.scheduleClassReminders.execute({ userId }),
				container.generateDailySummaries.execute({ userId }),
			]);
			response.status(200).json({ reminders, summaries });
		},

		/**
		 * POST /notifications/dispatch - Dispatch due notifications.
		 */
		dispatchNotifications: async (
			_request: Request,
			response: Response,
		): Promise<void> => {
			const result = await container.dispatchNotifications.execute();
			response.status(200).json(result);
		},

		/**
		 * GET /sync-runs/latest - Get latest sync run.
		 */
		latestSyncRun: async (
			request: Request,
			response: Response,
		): Promise<void> => {
			const sourceKey =
				optionalString(request.query.sourceKey) ??
				container.config.university.sourceKey;
			const latest = await container.uow.run((repositories) =>
				repositories.syncRuns.findLatest(sourceKey),
			);
			response.status(200).json({ syncRun: latest });
		},
	};
}
