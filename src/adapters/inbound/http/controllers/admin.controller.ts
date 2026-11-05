import { toUniversitySourceRequest } from '../../../../config/university-source-request.js';
import { LocalDate } from '../../../../domain/shared/local-date.js';
import {
	LatestSyncRunQuerySchema,
	OccurrencesRequestSchema,
	ScheduleNotificationsRequestSchema,
} from '../api/contracts/admin.js';
import type { HttpApiDependencies } from '../http-dependencies.js';
import type { HttpHandler } from '../http-handler.js';
import { parseBody, parseQuery } from '../parsing.js';

export interface AdminHandlers {
	syncAcademicData: HttpHandler;
	generateOccurrences: HttpHandler;
	scheduleNotifications: HttpHandler;
	dispatchNotifications: HttpHandler;
	getLatestSyncRun: HttpHandler;
}

/**
 * Administrative operations.
 *
 * Every handler delegates to an application use case; the controller only
 * parses the request, calls the use case, and writes the response.
 */
export function createAdminController(
	deps: Pick<HttpApiDependencies, 'config' | 'uow' | 'useCases'>,
): AdminHandlers {
	const { useCases } = deps;

	return {
		/**
		 * POST /api/admin/sync - Synchronize academic data for a term.
		 */
		syncAcademicData: async (_request, response): Promise<void> => {
			const result = await useCases.syncAcademicTerm.execute(
				toUniversitySourceRequest(deps.config.university),
			);

			response.status(200).json({
				synchronization: result.synchronization,
				termId: result.termId,
				occurrences: result.occurrences,
				warnings: result.snapshot.warnings,
				complete: result.snapshot.complete,
			});
		},

		/**
		 * POST /api/admin/occurrences - Generate class occurrences for a term.
		 */
		generateOccurrences: async (request, response): Promise<void> => {
			const body = parseBody(OccurrencesRequestSchema, request);
			const result = await useCases.generateClassOccurrences.execute({
				termId: body.termId,
				from: body.from ? LocalDate.parse(body.from) : undefined,
				to: body.to ? LocalDate.parse(body.to) : undefined,
				reconcileAbsent: body.reconcileAbsent === true,
			});

			response.status(200).json(result);
		},

		/**
		 * POST /api/admin/notifications/schedule - Schedule reminders and summaries.
		 */
		scheduleNotifications: async (request, response): Promise<void> => {
			const body = parseBody(ScheduleNotificationsRequestSchema, request);
			const userId = body.userId;

			const [reminders, examReminders, summaries] = await Promise.all([
				useCases.scheduleClassReminders.execute({ userId }),
				useCases.scheduleExamReminders.execute(),
				useCases.generateDailySummaries.execute({ userId }),
			]);

			response.status(200).json({ reminders, examReminders, summaries });
		},

		/**
		 * POST /api/admin/notifications/dispatch - Dispatch due notifications.
		 */
		dispatchNotifications: async (_request, response): Promise<void> => {
			const result = await useCases.dispatchNotifications.execute();
			response.status(200).json(result);
		},

		/**
		 * GET /api/admin/sync-runs/latest - Get latest sync run.
		 */
		getLatestSyncRun: async (request, response): Promise<void> => {
			const query = parseQuery(LatestSyncRunQuerySchema, request);
			const sourceKey = query.sourceKey ?? deps.config.university.sourceKey;

			const latest = await deps.uow.run((repositories) =>
				repositories.syncRuns.findLatest(sourceKey),
			);

			response.status(200).json({ syncRun: latest });
		},
	};
}
