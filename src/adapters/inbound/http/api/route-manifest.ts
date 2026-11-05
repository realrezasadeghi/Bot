/**
 * Single source of truth for the HTTP surface.
 *
 * `mountHttpRoutes` and the OpenAPI document builder both consume this
 * manifest, so a route cannot be mounted without being documented (and vice
 * versa). The operation id is the contract between the manifest, the route
 * handlers, and the OpenAPI operations.
 */
export type ApiRouteMethod = 'get' | 'post';

/** How a route is protected. */
export type ApiRouteAuth = 'none' | 'admin' | 'webhook';

export interface ApiRouteDefinition {
	method: ApiRouteMethod;
	path: string;
	operationId: string;
	auth: ApiRouteAuth;
}

export const apiRouteManifest = [
	{
		method: 'get',
		path: '/api/health',
		operationId: 'getHealth',
		auth: 'none',
	},
	{
		method: 'post',
		path: '/api/webhooks/telegram',
		operationId: 'telegramWebhook',
		auth: 'webhook',
	},
	{
		method: 'post',
		path: '/api/webhooks/bale',
		operationId: 'baleWebhook',
		auth: 'webhook',
	},
	{
		method: 'post',
		path: '/api/admin/sync',
		operationId: 'syncAcademicData',
		auth: 'admin',
	},
	{
		method: 'post',
		path: '/api/admin/occurrences',
		operationId: 'generateOccurrences',
		auth: 'admin',
	},
	{
		method: 'post',
		path: '/api/admin/notifications/schedule',
		operationId: 'scheduleNotifications',
		auth: 'admin',
	},
	{
		method: 'post',
		path: '/api/admin/notifications/dispatch',
		operationId: 'dispatchNotifications',
		auth: 'admin',
	},
	{
		method: 'get',
		path: '/api/admin/sync-runs/latest',
		operationId: 'getLatestSyncRun',
		auth: 'admin',
	},
] as const satisfies ReadonlyArray<ApiRouteDefinition>;

/** Every operation id declared by the manifest. */
export type ApiOperationId = (typeof apiRouteManifest)[number]['operationId'];
