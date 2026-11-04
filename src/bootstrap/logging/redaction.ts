/**
 * Redaction and truncation helpers for logged request data.
 *
 * Pure functions shared by the HTTP request logger. Sensitive values are
 * replaced recursively in headers, query parameters, and request bodies,
 * and oversized bodies are truncated before they reach the log stream.
 */

/** Placeholder written in place of every sensitive value. */
export const REDACTED = '[REDACTED]';

/** Maximum object/array nesting depth walked before truncating. */
const MAX_DEPTH = 10;

/**
 * Normalized (lowercase, alphanumeric-only) property names whose values must
 * never reach a log stream. Normalization makes matching case- and
 * separator-insensitive: `accessToken`, `access_token`, and `Access-Token`
 * all normalize to `accesstoken`.
 */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
	// Required redaction list.
	'password',
	'currentpassword',
	'newpassword',
	'authorization',
	'cookie',
	'token',
	'accesstoken',
	'refreshtoken',
	'apikey',
	'secret',
	'cardnumber',
	'cvv',
	// Common secret-bearing header spellings, including this app's webhook
	// secret headers (x-telegram-bot-api-secret-token, x-webhook-secret).
	'setcookie',
	'proxyauthorization',
	'xapikey',
	'xauthtoken',
	'xcsrftoken',
	'xwebhooksecret',
	'xtelegrambotapisecrettoken',
]);

/** Whether a property name (any casing/separator style) is sensitive. */
export function isSensitiveKey(key: string): boolean {
	return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

/**
 * Deep-copies a value, replacing sensitive properties with `[REDACTED]`.
 *
 * Handles nested objects and arrays. Buffers and typed arrays become
 * `[BINARY]`, dates become ISO strings, and recursion is depth-limited.
 * The input value is never mutated.
 */
export function redact(value: unknown): unknown {
	return redactValue(value, 0);
}

function redactValue(value: unknown, depth: number): unknown {
	if (value === null || typeof value !== 'object') {
		return value;
	}
	if (depth >= MAX_DEPTH) {
		return '[TRUNCATED: max depth exceeded]';
	}
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, depth + 1));
	}
	if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) {
		return '[BINARY]';
	}
	if (value instanceof Date) {
		return value.toISOString();
	}

	const result: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		result[key] = isSensitiveKey(key) ? REDACTED : redactValue(entry, depth + 1);
	}
	return result;
}

export interface BodyLogOptions {
	/** Whether request body logging is enabled (LOG_REQUEST_BODY). */
	enabled: boolean;
	/** Maximum serialized body size in characters (LOG_BODY_MAX_LENGTH). */
	maxLength: number;
}

/**
 * Builds the log fragment for a request body.
 *
 * Returns:
 * - `{}` when body logging is disabled or there is no parsed body;
 * - `{ body: ... }` with the redacted body — structured when it fits within
 *   `maxLength`, otherwise a truncated JSON string with a marker;
 * - `{ bodyOmittedReason: ... }` when a body exists but must never be
 *   logged (binary/streamed payload or an unsupported content type such as
 *   multipart or octet-stream).
 *
 * Only JSON, `+json`, URL-encoded, and `text/*` bodies are loggable; file
 * uploads and other binary payloads are always omitted.
 */
export function captureRequestBody(
	body: unknown,
	contentType: string | undefined,
	options: BodyLogOptions,
): Record<string, unknown> {
	if (!options.enabled || body === undefined || body === null) {
		return {};
	}
	if (Buffer.isBuffer(body) || ArrayBuffer.isView(body)) {
		return { bodyOmittedReason: 'binary body' };
	}
	if (isStreamLike(body)) {
		return { bodyOmittedReason: 'streamed body' };
	}
	if (contentType !== undefined && !isLoggableContentType(contentType)) {
		return { bodyOmittedReason: 'unsupported content type' };
	}

	const redacted = redact(body);
	let serialized: string;
	try {
		serialized = JSON.stringify(redacted) ?? '';
	} catch {
		// Circular or otherwise unserializable payload (not produced by the
		// built-in parsers, but possible through custom middleware).
		return { body: '[unserializable body]' };
	}

	if (serialized.length <= options.maxLength) {
		return { body: redacted };
	}
	return {
		body:
			serialized.slice(0, options.maxLength) +
			`...[truncated ${serialized.length - options.maxLength} chars]`,
	};
}

function isStreamLike(value: object): boolean {
	return (
		'pipe' in value && typeof (value as { pipe?: unknown }).pipe === 'function'
	);
}

function isLoggableContentType(contentType: string): boolean {
	const baseType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
	if (baseType === '') return false;
	return (
		baseType === 'application/json' ||
		baseType === 'application/x-www-form-urlencoded' ||
		baseType.endsWith('+json') ||
		baseType.startsWith('text/')
	);
}
