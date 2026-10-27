import type { NextFunction, Request, Response } from 'express';
import type { AppContainer } from '../container.js';

/**
 * Middleware that protects admin routes with a bearer token.
 *
 * When ADMIN_API_TOKEN is not configured, all admin routes return 503.
 * When the provided Authorization header does not match, returns 401.
 */
export function createAdminAuthMiddleware(container: AppContainer) {
	return (request: Request, response: Response, next: NextFunction): void => {
		const token = container.config.http.adminApiToken;
		if (!token) {
			response.status(503).json({
				error: {
					code: 'ADMIN_DISABLED',
					message: 'ADMIN_API_TOKEN is not configured',
				},
			});
			return;
		}
		if (request.header('authorization') !== `Bearer ${token}`) {
			response.status(401).json({
				error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' },
			});
			return;
		}
		next();
	};
}
