/// <reference types="zod-openapi" />
import { z } from 'zod';

/**
 * Error codes emitted by the centralized HTTP error handler.
 *
 * Keep this list in sync with `httpStatusOf` and `codeOf` in
 * `src/adapters/inbound/http/middleware/error-handler.ts`.
 */
export const ErrorCodeSchema = z
	.enum([
		'VALIDATION_ERROR',
		'NOT_FOUND',
		'CONFLICT',
		'INVARIANT_VIOLATION',
		'UNRESOLVED_INTEGRATION_REQUIREMENT',
		'EXTERNAL_SOURCE_ERROR',
		'INTERNAL_ERROR',
		'REQUEST_ERROR',
		'UNAUTHORIZED',
		'ADMIN_DISABLED',
	])
	.meta({ id: 'ErrorCode' });

/**
 * Standard error body returned by the centralized error handler.
 *
 * Webhook routes use a different, platform-compatible shape; see
 * `contracts/webhooks.ts`.
 */
export const ErrorEnvelopeSchema = z
	.object({
		error: z.object({
			code: ErrorCodeSchema,
			message: z.string(),
			details: z.unknown().optional(),
		}),
	})
	.meta({ id: 'ErrorEnvelope' });

/** Trimmed, non-empty string. */
export const NonEmptyStringSchema = z.string().trim().min(1);

/**
 * Local calendar date as accepted by the domain (`YYYY-MM-DD` or
 * `YYYY/MM/DD`, including Persian digits).
 */
export const LocalDateStringSchema = z.string().trim().min(1).meta({
	description:
		'Local calendar date (YYYY-MM-DD or YYYY/MM/DD). Persian digits are accepted.',
	example: '2026-11-05',
});

/** ISO 8601 timestamp produced by `Date.prototype.toJSON()`. */
export const IsoDateTimeSchema = z.iso.datetime();

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
