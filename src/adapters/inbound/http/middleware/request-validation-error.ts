import type { ZodError } from 'zod';

/**
 * Raised when a request body or query string does not match its contract.
 *
 * The centralized error handler maps this to `400 VALIDATION_ERROR` and
 * exposes the individual issues under `error.details.issues`.
 */
export class RequestValidationError extends Error {
	readonly issues: string[];

	constructor(error: ZodError) {
		const issues = error.issues.map((issue) => {
			const path = issue.path.join('.');
			return path ? `${path}: ${issue.message}` : issue.message;
		});

		super(`Invalid request: ${issues.join('; ')}`);
		this.name = 'RequestValidationError';
		this.issues = issues;
	}
}
