import { PlatformCode } from '../../../../domain/identity/platform-identity.js';
import { parseTelegramCompatibleUpdate } from '../../telegram-compatible-webhook.js';
import type {
	HttpApiDependencies,
	WebhookPlatform,
} from '../http-dependencies.js';
import type { HttpHandler } from '../http-handler.js';

export interface WebhookHandlers {
	telegramWebhook: HttpHandler;
	baleWebhook: HttpHandler;
}

/**
 * Inbound platform webhooks.
 *
 * Each webhook:
 * 1. Rejects the request when the platform is not configured (404)
 * 2. Validates the secret token header (when configured)
 * 3. Parses the incoming platform update
 * 4. Ignores non-actionable updates (200 { ok: true, ignored: true })
 * 5. Handles the message through the bot
 * 6. Returns 200 { ok: true }
 */
export function createWebhookController(
	deps: Pick<
		HttpApiDependencies,
		'logger' | 'messaging' | 'useCases' | 'webhookPlatforms'
	>,
): WebhookHandlers {
	return {
		telegramWebhook: createWebhookHandler(deps, PlatformCode.Telegram),
		baleWebhook: createWebhookHandler(deps, PlatformCode.Bale),
	};
}

function createWebhookHandler(
	deps: Pick<
		HttpApiDependencies,
		'logger' | 'messaging' | 'useCases' | 'webhookPlatforms'
	>,
	platform: PlatformCode,
): HttpHandler {
	return async (request, response): Promise<void> => {
		const binding = findPlatform(deps.webhookPlatforms, platform);

		if (!binding) {
			response.status(404).json({
				error: {
					code: 'NOT_FOUND',
					message: 'Route not found',
				},
			});
			return;
		}

		if (binding.webhookSecret) {
			const provided =
				request.header('x-telegram-bot-api-secret-token') ??
				request.header('x-webhook-secret');

			if (provided !== binding.webhookSecret) {
				response.status(401).json({
					ok: false,
					error: 'INVALID_WEBHOOK_SECRET',
				});
				return;
			}
		}

		const event = parseTelegramCompatibleUpdate({
			update: request.body,
			platform: binding.platform,
			botScope: binding.botScope,
		});

		if (!event) {
			response.status(200).json({ ok: true, ignored: true });
			return;
		}

		const outbound = await deps.useCases.handleIncoming.execute(event);

		if (outbound) {
			const result = await deps.messaging.send(outbound);

			if (!result.delivered) {
				deps.logger.warn(
					{
						platform: binding.platform,
						provider: result.provider,
						error: result.error,
					},
					'Failed to send bot response',
				);
			}
		}

		response.status(200).json({ ok: true });
	};
}

function findPlatform(
	platforms: readonly WebhookPlatform[],
	platform: PlatformCode,
): WebhookPlatform | undefined {
	return platforms.find((entry) => entry.platform === platform);
}
