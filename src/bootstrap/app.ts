import express from 'express';
import type { AppContainer } from './container.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createHttpLogger } from './middleware/http-logger.js';
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

	// First in the pipeline: every request that reaches the application is
	// logged, including requests later rejected by body parsing,
	// authentication, or the 404 handler.
	app.use(
		createHttpLogger({ pino: container.pinoLogger, log: container.config.log }),
	);

	app.use(express.json({ limit: container.config.http.bodyLimit }));
	// URL-encoded bodies too, so form posts are parsed (and therefore logged)
	// alongside JSON.
	app.use(
		express.urlencoded({
			extended: true,
			limit: container.config.http.bodyLimit,
		}),
	);

	mountRoutes(app, container);

	app.use(notFoundHandler);
	app.use(createErrorHandler());

	return app;
}
