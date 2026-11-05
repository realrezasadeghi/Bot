import type { Request } from 'express';
import type { z } from 'zod';
import { RequestValidationError } from './middleware/request-validation-error.js';

/**
 * Validates and narrows a JSON request body against its Zod contract.
 *
 * A missing body is treated as `{}` so optional-body routes keep working
 * while required fields still produce a `400 VALIDATION_ERROR`.
 */
export function parseBody<T>(schema: z.ZodType<T>, request: Request): T {
	return parse(schema, request.body ?? {});
}

/** Validates and narrows a query string against its Zod contract. */
export function parseQuery<T>(schema: z.ZodType<T>, request: Request): T {
	return parse(schema, request.query ?? {});
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new RequestValidationError(result.error);
	}
	return result.data;
}
