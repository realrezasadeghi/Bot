import type { Application } from 'express';
import { type ApiOperationId, apiRouteManifest } from './api/route-manifest.js';
import { createAdminController } from './controllers/admin.controller.js';
import { createHealthController } from './controllers/health.controller.js';
import { createWebhookController } from './controllers/webhook.controller.js';
import type { HttpApiDependencies } from './http-dependencies.js';
import type { HttpHandler } from './http-handler.js';
import { createAdminAuthMiddleware } from './middleware/admin-auth.js';

/**
 * Every route handler, keyed by the operation id of the route manifest.
 *
 * The type is derived from the manifest, so a documented route without an
 * implementation is a compile error and an undocumented handler is rejected
 * by the excess-property check.
 */
export type HttpHandlers = Record<ApiOperationId, HttpHandler>;

/** Builds the handler of every documented route. */
export function createHttpHandlers(deps: HttpApiDependencies): HttpHandlers {
	return {
		...createHealthController(deps),
		...createAdminController(deps),
		...createWebhookController(deps),
	};
}

/**
 * Mounts every API route declared in `apiRouteManifest`.
 *
 * The manifest is also used to build the OpenAPI document, so mounted routes
 * and documented routes cannot drift apart.
 *
 * Routes:
 *   GET    /api/health
 *   POST   /api/webhooks/telegram
 *   POST   /api/webhooks/bale
 *   POST   /api/admin/sync
 *   POST   /api/admin/occurrences
 *   POST   /api/admin/notifications/schedule
 *   POST   /api/admin/notifications/dispatch
 *   GET    /api/admin/sync-runs/latest
 */
export function mountHttpRoutes(
	app: Application,
	deps: HttpApiDependencies,
): void {
	const handlers = createHttpHandlers(deps);

	// Preserve the existing behaviour: unknown /api/admin paths are rejected
	// by authentication before reaching the 404 handler.
	app.use(
		'/api/admin',
		createAdminAuthMiddleware(deps.config.http.adminApiToken),
	);

	for (const route of apiRouteManifest) {
		const handler = handlers[route.operationId];

		if (route.method === 'get') {
			app.get(route.path, handler);
		} else {
			app.post(route.path, handler);
		}
	}
}
