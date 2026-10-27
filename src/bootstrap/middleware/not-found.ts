import type { Request, Response } from 'express';

/**
 * 404 handler for routes that are not defined.
 */
export function notFoundHandler(_request: Request, response: Response): void {
	response.status(404).json({
		error: { code: 'NOT_FOUND', message: 'Route not found' },
	});
}
