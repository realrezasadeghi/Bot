import type { NextFunction, Request, Response } from 'express';
import { UniversitySnapshotValidationError } from '../../application/dto/university.js';
import { ConfigurationError } from '../../config/env.js';
import { DomainError } from '../../domain/shared/errors.js';

/**
 * Centralized error-handling middleware.
 *
 * Maps domain errors to appropriate HTTP status codes and returns a
 * consistent JSON error body.
 *
 * The error is handed to the HTTP request logger by assigning it to
 * `response.err`: when the response finishes, pino-http emits a single log
 * line carrying the serialized error together with the request id, method,
 * path, status, and duration. Logging here as well would duplicate every
 * error entry.
 */
export function createErrorHandler() {
	return (
		error: unknown,
		_request: Request,
		response: Response,
		_next: NextFunction,
	): void => {
		const status = httpStatusOf(error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		response.err = error instanceof Error ? error : new Error(String(error));

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
