import { z } from 'zod';
import {
	createDocument,
	type ZodOpenApiOperationObject,
	type ZodOpenApiPathsObject,
} from 'zod-openapi';
import {
	DispatchResponseSchema,
	ErrorEnvelopeSchema,
	HealthResponseSchema,
	LatestSyncRunQuerySchema,
	LatestSyncRunResponseSchema,
	OccurrencesRequestSchema,
	OccurrencesResponseSchema,
	ScheduleNotificationsRequestSchema,
	ScheduleNotificationsResponseSchema,
	SyncResponseSchema,
	WebhookIgnoredSchema,
	WebhookSuccessSchema,
	WebhookUnauthorizedSchema,
	WebhookUpdateSchema,
} from './contracts/index.js';
import { type ApiOperationId, apiRouteManifest } from './route-manifest.js';

export type OpenApiDocument = ReturnType<typeof createDocument>;

const jsonContent = (schema: z.ZodType) => ({
	'application/json': { schema },
});

const jsonResponse = (description: string, schema: z.ZodType) => ({
	description,
	content: jsonContent(schema),
});

const errorResponse = (description: string) => ({
	description,
	content: jsonContent(ErrorEnvelopeSchema),
});

/**
 * Errors shared by every authenticated admin operation.
 *
 * The handler's error mapping is centralized, so these are all reachable
 * regardless of which use-case runs.
 */
const adminErrorResponses = {
	400: errorResponse('Invalid request'),
	401: errorResponse('Missing or invalid admin token'),
	404: errorResponse('Resource not found'),
	409: errorResponse('Conflict'),
	422: errorResponse('Snapshot validation failed'),
	500: errorResponse('Unexpected server error'),
	501: errorResponse('Integration requirement not resolved'),
	502: errorResponse('External source error'),
	503: errorResponse('Admin API disabled or configuration error'),
};

const webhookHeaders = z.object({
	'x-telegram-bot-api-secret-token': z.string().optional().meta({
		description:
			'Telegram webhook secret. Required when TELEGRAM_WEBHOOK_SECRET is configured.',
	}),
	'x-webhook-secret': z.string().optional().meta({
		description:
			'Bale/generic webhook secret. Required when the platform webhook secret is configured.',
	}),
});

const webhookResponse = z.union([WebhookSuccessSchema, WebhookIgnoredSchema]);

const webhookRequest = {
	required: true as const,
	content: jsonContent(WebhookUpdateSchema),
};

const webhookResponses = {
	200: jsonResponse('Update accepted', webhookResponse),
	401: {
		description: 'Invalid or missing webhook secret',
		content: jsonContent(WebhookUnauthorizedSchema),
	},
	404: errorResponse('The platform is not configured'),
};

/**
 * The OpenAPI operation of every route.
 *
 * Keys match the `operationId` of the route manifest, which is also the key
 * used to place the operation in the document. Security requirements are not
 * declared here: they are derived from the manifest's `auth` field.
 */
const operations = {
	getHealth: {
		tags: ['Health'],
		operationId: 'getHealth',
		summary: 'Health check',
		description: 'Returns `{ status: "ok" }` when the database is reachable.',
		responses: {
			200: jsonResponse('Healthy', HealthResponseSchema),
			500: errorResponse('Database unreachable or unexpected error'),
		},
	},
	telegramWebhook: {
		tags: ['Webhooks'],
		operationId: 'telegramWebhook',
		summary: 'Receive a Telegram update',
		description:
			'Accepts a Telegram update. Returns 404 when TELEGRAM_BOT_TOKEN is not configured. When TELEGRAM_WEBHOOK_SECRET is configured, the matching secret header is required.',
		requestParams: { header: webhookHeaders },
		requestBody: webhookRequest,
		responses: webhookResponses,
	},
	baleWebhook: {
		tags: ['Webhooks'],
		operationId: 'baleWebhook',
		summary: 'Receive a Bale update',
		description:
			'Accepts a Bale update. Returns 404 when BALE_BOT_TOKEN is not configured. When BALE_WEBHOOK_SECRET is configured, the matching secret header is required.',
		requestParams: { header: webhookHeaders },
		requestBody: webhookRequest,
		responses: webhookResponses,
	},
	syncAcademicData: {
		tags: ['Admin'],
		operationId: 'syncAcademicData',
		summary: 'Synchronize academic data',
		description:
			'Fetches a university snapshot, persists it, and generates class occurrences.',
		responses: {
			200: jsonResponse('Synchronization result', SyncResponseSchema),
			...adminErrorResponses,
		},
	},
	generateOccurrences: {
		tags: ['Admin'],
		operationId: 'generateOccurrences',
		summary: 'Generate class occurrences',
		requestBody: {
			required: true,
			content: jsonContent(OccurrencesRequestSchema),
		},
		responses: {
			200: jsonResponse('Occurrence generation result', OccurrencesResponseSchema),
			...adminErrorResponses,
		},
	},
	scheduleNotifications: {
		tags: ['Admin'],
		operationId: 'scheduleNotifications',
		summary: 'Schedule reminders and daily summaries',
		requestBody: {
			required: false,
			content: jsonContent(ScheduleNotificationsRequestSchema),
		},
		responses: {
			200: jsonResponse('Scheduling results', ScheduleNotificationsResponseSchema),
			...adminErrorResponses,
		},
	},
	dispatchNotifications: {
		tags: ['Admin'],
		operationId: 'dispatchNotifications',
		summary: 'Dispatch due notification jobs',
		responses: {
			200: jsonResponse('Dispatch result', DispatchResponseSchema),
			...adminErrorResponses,
		},
	},
	getLatestSyncRun: {
		tags: ['Admin'],
		operationId: 'getLatestSyncRun',
		summary: 'Get the latest sync run',
		requestParams: { query: LatestSyncRunQuerySchema },
		responses: {
			200: jsonResponse(
				'Latest sync run for the source',
				LatestSyncRunResponseSchema,
			),
			...adminErrorResponses,
		},
	},
} satisfies Record<ApiOperationId, ZodOpenApiOperationObject>;

/**
 * Builds the document paths from the route manifest.
 *
 * The manifest is the single source of truth for the HTTP surface: it
 * defines the path, the method, the operation id, and the authentication
 * mode of every route.
 */
function buildPaths(): ZodOpenApiPathsObject {
	const paths: ZodOpenApiPathsObject = {};

	for (const route of apiRouteManifest) {
		const pathItem = paths[route.path] ?? {};
		const operation: ZodOpenApiOperationObject = {
			...operations[route.operationId],
			security: route.auth === 'admin' ? [{ bearerAuth: [] }] : [],
		};

		if (route.method === 'get') {
			pathItem.get = operation;
		} else {
			pathItem.post = operation;
		}

		paths[route.path] = pathItem;
	}

	return paths;
}

/**
 * Builds the OpenAPI 3.1 document from the shared Zod contracts.
 *
 * The document is generated in memory so the served specification always
 * matches the running code. `scripts/generate-openapi.ts` writes the same
 * document to `docs/openapi.json` for CI linting and review.
 */
export function buildOpenApiDocument(): OpenApiDocument {
	return createDocument({
		openapi: '3.1.0',
		info: {
			title: 'Academic Scheduling Bot API',
			version: '1.0.0',
			description:
				'HTTP API for the academic scheduling bot. Admin routes require a bearer token; webhooks use platform secret headers.',
			license: { name: 'Proprietary' },
		},
		servers: [{ url: '/', description: 'Current host' }],
		tags: [
			{ name: 'Health', description: 'Service health checks.' },
			{ name: 'Webhooks', description: 'Inbound platform webhooks.' },
			{
				name: 'Admin',
				description: 'Authenticated administrative operations.',
			},
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					description: 'Admin API token configured through ADMIN_API_TOKEN.',
				},
			},
		},
		paths: buildPaths(),
	});
}
