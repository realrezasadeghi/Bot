import express, { type Application } from 'express';
import { mountApiDocs } from './api/docs.js';
import { buildOpenApiDocument } from './api/openapi.js';
import type { HttpApiDependencies } from './http-dependencies.js';
import { mountHttpRoutes } from './http-router.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createHttpLogger } from './middleware/http-logger.js';
import { notFoundHandler } from './middleware/not-found.js';

/**
 * Creates the HTTP application (the Express driving adapter).
 *
 * Middleware order matters:
 *  1. the request logger, so every request is logged exactly once;
 *  2. the body parsers, so the logger can see the parsed body;
 *  3. the routes;
 *  4. the API documentation;
 *  5. the 404 and error handlers.
 *
 * The adapter is framework-bound but framework-free of the application core:
 * it only knows the use cases and ports it was given.
 */
export function createHttpApi(deps: HttpApiDependencies): Application {
	const app = express();
	app.disable('x-powered-by');

	// First in the pipeline: every request that reaches the application is
	// logged, including requests later rejected by body parsing,
	// authentication, or the 404 handler.
	app.use(createHttpLogger({ pino: deps.pinoLogger, log: deps.config.log }));

	app.use(express.json({ limit: deps.config.http.bodyLimit }));
	// URL-encoded bodies too, so form posts are parsed (and therefore logged)
	// alongside JSON.
	app.use(
		express.urlencoded({
			extended: true,
			limit: deps.config.http.bodyLimit,
		}),
	);

	mountHttpRoutes(app, deps);

	mountApiDocs(app, {
		...deps.config.http.apiDocs,
		document: buildOpenApiDocument(),
	});

	app.use(notFoundHandler);
	app.use(createErrorHandler());

	return app;
}
