import { apiReference } from '@scalar/express-api-reference';
import type { Application } from 'express';
import type { OpenApiDocument } from './openapi.js';

export interface ApiDocsOptions {
	/** Whether the documentation is served at all. */
	enabled: boolean;
	/** Path of the Scalar API reference, for example `/api/docs`. */
	path: string;
	/** Path of the raw OpenAPI document, for example `/api/openapi.json`. */
	openapiPath: string;
	/** The generated OpenAPI document that is served. */
	document: OpenApiDocument;
}

/**
 * Serves the generated OpenAPI document and the Scalar API reference.
 *
 * The document is injected: building it is the API description's job, while
 * this module only delivers it over HTTP.
 *
 * Disabled when `API_DOCS_ENABLED` is false (the default in production), so
 * the admin surface is not exposed publicly unless explicitly enabled.
 */
export function mountApiDocs(app: Application, options: ApiDocsOptions): void {
	if (!options.enabled) return;

	app.get(options.openapiPath, (_request, response) => {
		response.status(200).json(options.document);
	});

	app.use(
		options.path,
		apiReference({
			url: options.openapiPath,
			pageTitle: 'Academic Scheduling Bot API',
		}),
	);
}
