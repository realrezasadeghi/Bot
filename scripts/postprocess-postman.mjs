/**
 * Post-processes the generated Postman collection.
 *
 * `openapi2postmanv2` emits literal placeholders (`<string>`, `<boolean>`) for
 * request bodies and header parameters, and it keeps every documented header
 * on every request. This script makes the collection usable against a real
 * server:
 *
 * - request bodies are replaced with the examples declared in the OpenAPI
 *   document;
 * - webhook secret headers are bound to the Postman environment variables;
 * - each webhook request keeps only the secret header of its own platform,
 *   because the middleware reads `x-telegram-bot-api-secret-token` first and a
 *   placeholder for the other platform would reject the request.
 *
 * Usage: node scripts/postprocess-postman.mjs [collectionPath]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const collectionPath = resolve(
	projectRoot,
	process.argv[2] ?? 'postman/api-routes.postman_collection.json',
);
const specPath = resolve(projectRoot, 'docs/openapi.json');

const WEBHOOK_SECRET_HEADERS = {
	telegram: {
		header: 'x-telegram-bot-api-secret-token',
		variable: '{{telegramWebhookSecret}}',
		remove: 'x-webhook-secret',
	},
	bale: {
		header: 'x-webhook-secret',
		variable: '{{baleWebhookSecret}}',
		remove: 'x-telegram-bot-api-secret-token',
	},
};

/** @param {unknown} value */
function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const spec = JSON.parse(await readFile(specPath, 'utf8'));
const schemas =
	isRecord(spec.components) && isRecord(spec.components.schemas)
		? spec.components.schemas
		: {};

/**
 * Resolves the example of a request body schema, following `$ref`s.
 *
 * @param {unknown} schema
 * @returns {unknown}
 */
function resolveExample(schema) {
	if (!isRecord(schema)) return undefined;

	const reference = schema.$ref;
	if (typeof reference === 'string') {
		const name = reference.split('/').pop();
		return name ? resolveExample(schemas[name]) : undefined;
	}

	return schema.example;
}

/**
 * Returns the JSON example declared for a request, if any.
 *
 * @param {string} specPath
 * @param {string} method
 * @returns {unknown}
 */
function requestExample(specPath, method) {
	const paths = isRecord(spec.paths) ? spec.paths : {};
	const pathItem = paths[specPath];
	if (!isRecord(pathItem)) return undefined;

	const operation = pathItem[method.toLowerCase()];
	if (!isRecord(operation)) return undefined;

	const requestBody = operation.requestBody;
	if (!isRecord(requestBody)) return undefined;

	const content = requestBody.content;
	if (!isRecord(content)) return undefined;

	const json = content['application/json'];
	if (!isRecord(json)) return undefined;

	return resolveExample(json.schema);
}

/**
 * @param {unknown[]} items
 * @returns {void}
 */
function applyToItems(items) {
	for (const item of items) {
		if (!isRecord(item)) continue;

		if (Array.isArray(item.item)) {
			applyToItems(item.item);
		}

		const request = item.request;
		if (!isRecord(request)) continue;

		const url = request.url;
		if (!isRecord(url) || !Array.isArray(url.path)) continue;

		const path = url.path.join('/');
		const specPath = `/${path}`;
		const method = typeof request.method === 'string' ? request.method : 'GET';

		const example = requestExample(specPath, method);
		if (example !== undefined) {
			request.body = {
				mode: 'raw',
				raw: JSON.stringify(example, null, 2),
				options: { raw: { language: 'json' } },
				disabled: false,
			};
		}

		if (Array.isArray(url.query)) {
			for (const query of url.query) {
				if (isRecord(query) && query.key === 'sourceKey') {
					query.value = '{{sourceKey}}';
					query.type = 'text';
				}
			}
		}

		const platform = specPath.includes('/webhooks/telegram')
			? 'telegram'
			: specPath.includes('/webhooks/bale')
				? 'bale'
				: null;
		if (!platform) continue;

		const { header, variable, remove } = WEBHOOK_SECRET_HEADERS[platform];
		const headers = Array.isArray(request.header) ? request.header : [];

		for (const existing of headers) {
			if (!isRecord(existing)) continue;
			if (existing.key === header) {
				existing.value = variable;
				existing.type = 'text';
			}
		}

		// Keep only the secret header that belongs to this platform: the
		// middleware reads `x-telegram-bot-api-secret-token` first, so a
		// placeholder for the other platform would reject the request.
		request.header = headers.filter(
			(existing) => !isRecord(existing) || existing.key !== remove,
		);
	}
}

const collection = JSON.parse(await readFile(collectionPath, 'utf8'));

if (Array.isArray(collection.item)) {
	applyToItems(collection.item);
}

await writeFile(
	collectionPath,
	`${JSON.stringify(collection, null, '\t')}\n`,
	'utf8',
);

process.stdout.write(`Post-processed ${collectionPath}\n`);
