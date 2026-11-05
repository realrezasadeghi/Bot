import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware that protects admin routes with a bearer token.
 *
 * When ADMIN_API_TOKEN is not configured, all admin routes return 503.
 * When the provided Authorization header does not match, returns 401.
 */
export function createAdminAuthMiddleware(adminApiToken: string | undefined) {
	return (request: Request, response: Response, next: NextFunction): void => {
		if (!adminApiToken) {
			response.status(503).json({
				error: {
					code: 'ADMIN_DISABLED',
					message: 'ADMIN_API_TOKEN is not configured',
				},
			});
			return;
		}
		if (request.header('authorization') !== `Bearer ${adminApiToken}`) {
			response.status(401).json({
				error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' },
			});
			return;
		}
		next();
	};
}
