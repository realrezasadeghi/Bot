import type { Request, Response } from 'express';

/**
 * A request handler of the HTTP driving adapter.
 *
 * Handlers translate an HTTP request into a use-case call and write the
 * response. They never talk to the database or to external services
 * directly — that is the application layer's job.
 */
export type HttpHandler = (
	request: Request,
	response: Response,
) => Promise<void>;
