import type { Request } from 'express';

/**
 * Extracts a trimmed non-empty string from an unknown value, or returns
 * undefined when the value is missing, empty, or not a string.
 */
export function optionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0
		? value.trim()
		: undefined;
}

/**
 * Safely extracts a JSON body object from an Express request.
 */
export function bodyOf(request: Request): Record<string, unknown> {
	return typeof request.body === 'object' && request.body !== null
		? (request.body as Record<string, unknown>)
		: {};
}
