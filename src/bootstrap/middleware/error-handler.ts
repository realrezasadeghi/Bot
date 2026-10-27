import type { NextFunction, Request, Response } from 'express';
import { UniversitySnapshotValidationError } from '../../application/dto/university.js';
import { ConfigurationError } from '../../config/env.js';
import { DomainError } from '../../domain/shared/errors.js';
import type { AppContainer } from '../container.js';
import { serializeError } from '../serialize-error.js';

/**
 * Centralized error-handling middleware.
 *
 * Maps domain errors to appropriate HTTP status codes and returns a
 * consistent JSON error body. Logs the error with request context.
 */
export function createErrorHandler(container: AppContainer) {
	return (
		error: unknown,
		request: Request,
		response: Response,
		_next: NextFunction,
	): void => {
		const status = httpStatusOf(error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		container.logger.error(
			{
				status,
				method: request.method,
				path: request.originalUrl,
				error: serializeError(error),
			},
			'HTTP request failed',
		);

		const details =
			error instanceof UniversitySnapshotValidationError
				? { issues: error.issues }
				: undefined;

		const code =
			error instanceof DomainError
				? error.code
				: status === 500
					? 'INTERNAL_ERROR'
					: 'REQUEST_ERROR';

		response.status(status).json({
			error: {
				code,
				message,
				details,
			},
		});
	};
}

function httpStatusOf(error: unknown): number {
	if (error instanceof UniversitySnapshotValidationError) return 422;
	if (error instanceof ConfigurationError) return 503;
	if (error instanceof DomainError) {
		switch (error.code) {
			case 'VALIDATION_ERROR':
				return 400;
			case 'NOT_FOUND':
				return 404;
			case 'CONFLICT':
				return 409;
			case 'UNRESOLVED_INTEGRATION_REQUIREMENT':
				return 501;
			case 'EXTERNAL_SOURCE_ERROR':
				return 502;
			default:
				return 400;
		}
	}
	if (
		typeof error === 'object' &&
		error !== null &&
		'type' in error &&
		(error as { type?: unknown }).type === 'entity.parse.failed'
	) {
		return 400;
	}
	return 500;
}
