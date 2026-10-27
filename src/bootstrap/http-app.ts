import express, {
	type NextFunction,
	type Request,
	type Response,
} from 'express';
import { parseTelegramCompatibleUpdate } from '../adapters/inbound/telegram-compatible-webhook.js';
import { UniversitySnapshotValidationError } from '../application/dto/university.js';
import { ConfigurationError } from '../config/env.js';
import { PlatformCode } from '../domain/identity/platform-identity.js';
import { DomainError, ValidationError } from '../domain/shared/errors.js';
import { LocalDate } from '../domain/shared/local-date.js';
import type { AppContainer } from './container.js';
import { serializeError } from './serialize-error.js';
import { syncTerm } from './sync-term.js';

type AsyncHandler = (request: Request, response: Response) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
	return (request: Request, response: Response, next: NextFunction): void => {
		handler(request, response).catch(next);
	};
}

function bodyOf(request: Request): Record<string, unknown> {
	return typeof request.body === 'object' && request.body !== null
		? (request.body as Record<string, unknown>)
		: {};
}

function optionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0
		? value.trim()
		: undefined;
}

function httpStatusOf(error: unknown): number {
	if (error instanceof UniversitySnapshotValidationError) return 422;
	if (error instanceof ConfigurationError) return 503;
	if (error instanceof ValidationError) return 400;
	if (error instanceof DomainError) {
		switch (error.code) {
			case 'VALIDATION_ERROR':
				return 400;
			case 'NOT_FOUND':
				return 404;
			case 'CONFLICT':
				return 409;
			case 'UNRESOLVED_INTEGRATION_REQUIREMENT':
				return 501;
			case 'EXTERNAL_SOURCE_ERROR':
				return 502;
			default:
				return 400;
		}
	}
	if (
		typeof error === 'object' &&
		error !== null &&
		'type' in error &&
		(error as { type?: unknown }).type === 'entity.parse.failed'
	) {
		return 400;
	}
	return 500;
}

export function createHttpApp(container: AppContainer) {
	const app = express();
	app.disable('x-powered-by');
	app.use(express.json({ limit: container.config.http.bodyLimit }));

	app.get(
		'/health',
		asyncHandler(async (_request, response) => {
			await container.uow.run((repositories) =>
				repositories.academic.listLevels(),
			);
			response.status(200).json({ status: 'ok' });
		}),
	);

	const webhooks: Array<{
		platform: PlatformCode;
		path: string;
		secret?: string;
	}> = [];
	if (container.config.telegram) {
		webhooks.push({
			platform: PlatformCode.Telegram,
			path: 'telegram',
			secret: container.config.telegram.webhookSecret,
		});
	}
	if (container.config.bale) {
		webhooks.push({
			platform: PlatformCode.Bale,
			path: 'bale',
			secret: container.config.bale.webhookSecret,
		});
	}

	for (const webhook of webhooks) {
		app.post(
			`/webhooks/${webhook.path}`,
			asyncHandler(async (request, response) => {
				if (webhook.secret) {
					const provided =
						request.header('x-telegram-bot-api-secret-token') ??
						request.header('x-webhook-secret');
					if (provided !== webhook.secret) {
						response.status(401).json({ ok: false, error: 'INVALID_WEBHOOK_SECRET' });
						return;
					}
				}

				const botScope =
					(webhook.platform === PlatformCode.Telegram
						? container.config.telegram?.botScope
						: container.config.bale?.botScope) ?? '';
				const event = parseTelegramCompatibleUpdate({
					update: request.body,
					platform: webhook.platform,
					botScope,
				});

				if (!event) {
					response.status(200).json({ ok: true, ignored: true });
					return;
				}

				const outbound = await container.handleIncoming.execute(event);
				if (outbound) {
					const result = await container.messaging.send(outbound);
					if (!result.delivered) {
						container.logger.warn(
							{
								platform: webhook.platform,
								provider: result.provider,
								error: result.error,
							},
							'Failed to send bot response',
						);
					}
				}

				response.status(200).json({ ok: true });
			}),
		);
	}

	app.use('/admin', (request, response, next) => {
		const token = container.config.http.adminApiToken;
		if (!token) {
			response.status(503).json({
				error: {
					code: 'ADMIN_DISABLED',
					message: 'ADMIN_API_TOKEN is not configured',
				},
			});
			return;
		}
		if (request.header('authorization') !== `Bearer ${token}`) {
			response.status(401).json({
				error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' },
			});
			return;
		}
		next();
	});

	app.post(
		'/admin/sync',
		asyncHandler(async (request, response) => {
			const body = bodyOf(request);
			const termCode =
				optionalString(body.termCode) ?? container.config.university.termCode;
			const result = await syncTerm(container, termCode);
			response.status(200).json({
				synchronization: result.synchronization,
				termId: result.termId,
				occurrences: result.occurrences,
				warnings: result.snapshot.warnings,
				complete: result.snapshot.complete,
			});
		}),
	);

	app.post(
		'/admin/occurrences',
		asyncHandler(async (request, response) => {
			const body = bodyOf(request);
			const termId = optionalString(body.termId);
			if (!termId) {
				response.status(400).json({
					error: { code: 'VALIDATION_ERROR', message: 'termId is required' },
				});
				return;
			}

			const from = optionalString(body.from);
			const to = optionalString(body.to);
			const result = await container.generateClassOccurrences.execute({
				termId,
				from: from ? LocalDate.parse(from) : undefined,
				to: to ? LocalDate.parse(to) : undefined,
				reconcileAbsent: body.reconcileAbsent === true,
			});
			response.status(200).json(result);
		}),
	);

	app.post(
		'/admin/notifications/schedule',
		asyncHandler(async (request, response) => {
			const userId = optionalString(bodyOf(request).userId);
			const [reminders, summaries] = await Promise.all([
				container.scheduleClassReminders.execute({ userId }),
				container.generateDailySummaries.execute({ userId }),
			]);
			response.status(200).json({ reminders, summaries });
		}),
	);

	app.post(
		'/admin/notifications/dispatch',
		asyncHandler(async (_ـ, response) => {
			const result = await container.dispatchNotifications.execute();
			response.status(200).json(result);
		}),
	);

	app.get(
		'/admin/sync-runs/latest',
		asyncHandler(async (request, response) => {
			const sourceKey =
				optionalString(request.query.sourceKey) ??
				container.config.university.sourceKey;
			const latest = await container.uow.run((repositories) =>
				repositories.syncRuns.findLatest(sourceKey),
			);
			response.status(200).json({ syncRun: latest });
		}),
	);

	app.use((_request: Request, response: Response) => {
		response.status(404).json({
			error: { code: 'NOT_FOUND', message: 'Route not found' },
		});
	});

	app.use(
		(
			error: unknown,
			request: Request,
			response: Response,
			_next: NextFunction,
		) => {
			const status = httpStatusOf(error);
			const message = error instanceof Error ? error.message : 'Unknown error';
			container.logger.error(
				{
					status,
					method: request.method,
					path: request.originalUrl,
					error: serializeError(error),
				},
				'HTTP request failed',
			);

			const details =
				error instanceof UniversitySnapshotValidationError
					? { issues: error.issues }
					: undefined;

			const code =
				error instanceof DomainError
					? error.code
					: status === 500
						? 'INTERNAL_ERROR'
						: 'REQUEST_ERROR';

			response.status(status).json({
				error: {
					code,
					message,
					details,
				},
			});
		},
	);

	return app;
}
