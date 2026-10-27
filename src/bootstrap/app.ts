import express from 'express';
import type { AppContainer } from './container.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { mountRoutes } from './routes/index.js';

/**
 * Creates and configures the Express application.
 *
 * Applies global middleware, mounts all API routes under /api, and registers
 * the 404 and error handlers.
 *
 * Does not listen on a port — that is the responsibility of http.ts.
 */
export function createApp(container: AppContainer): ReturnType<typeof express> {
	const app = express();
	app.disable('x-powered-by');
	app.use(express.json({ limit: container.config.http.bodyLimit }));

	mountRoutes(app, container);

	app.use(notFoundHandler);
	app.use(createErrorHandler(container));

	return app;
}
