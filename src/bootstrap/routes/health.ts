import type { Request, Response } from 'express';
import type { AppContainer } from '../container.js';

/**
 * Health check endpoint.
 *
 * Verifies the database connection is working by querying academic levels.
 *
 * Responses:
 * - 200 { status: 'ok' } - Healthy
 * - 500 - Database unreachable
 */
export function createHealthRoute(container: AppContainer) {
	return async (_request: Request, response: Response): Promise<void> => {
		await container.uow.run((repositories) => repositories.academic.listLevels());
		response.status(200).json({ status: 'ok' });
	};
}
