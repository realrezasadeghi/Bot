import type { HttpApiDependencies } from '../http-dependencies.js';
import type { HttpHandler } from '../http-handler.js';

export interface HealthHandlers {
	getHealth: HttpHandler;
}

/**
 * Health check endpoint.
 *
 * Verifies the database connection is working by querying academic levels.
 *
 * Responses:
 * - 200 { status: 'ok' } - Healthy
 * - 500 - Database unreachable
 */
export function createHealthController(
	deps: Pick<HttpApiDependencies, 'uow'>,
): HealthHandlers {
	return {
		getHealth: async (_request, response): Promise<void> => {
			await deps.uow.run((repositories) => repositories.academic.listLevels());
			response.status(200).json({ status: 'ok' });
		},
	};
}
