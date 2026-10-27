import type { Application } from 'express';
import type { AppContainer } from '../container.js';
import { createAdminAuthMiddleware } from '../middleware/admin-auth.js';
import { createAdminRoutes } from './admin.js';
import { createHealthRoute } from './health.js';
import { createWebhookRoutes } from './webhooks.js';

/**
 * Mounts all API route modules under the /api prefix.
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
export function mountRoutes(app: Application, container: AppContainer): void {
	const health = createHealthRoute(container);
	const webhooks = createWebhookRoutes(container);
	const admin = createAdminRoutes(container);

	// Health
	app.get('/api/health', health);

	// Webhooks
	for (const { path, handler } of webhooks) {
		app.post(`/api/webhooks/${path}`, handler);
	}

	// Admin (authenticated)
	const adminAuth = createAdminAuthMiddleware(container);
	app.use('/api/admin', adminAuth);
	app.post('/api/admin/sync', admin.sync);
	app.post('/api/admin/occurrences', admin.occurrences);
	app.post('/api/admin/notifications/schedule', admin.scheduleNotifications);
	app.post('/api/admin/notifications/dispatch', admin.dispatchNotifications);
	app.get('/api/admin/sync-runs/latest', admin.latestSyncRun);
}
