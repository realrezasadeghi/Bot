import type { Request, Response } from 'express';
import { parseTelegramCompatibleUpdate } from '../../adapters/inbound/telegram-compatible-webhook.js';
import { PlatformCode } from '../../domain/identity/platform-identity.js';
import type { AppContainer } from '../container.js';

interface WebhookRoute {
	path: string;
	handler: (request: Request, response: Response) => Promise<void>;
}

interface WebhookConfig {
	platform: PlatformCode;
	path: string;
	secret?: string;
	botScope?: string;
}

/**
 * Telegram and Bale webhook routes.
 *
 * Each webhook:
 * 1. Validates the secret token header (when configured)
 * 2. Parses the incoming platform update
 * 3. Ignores non-actionable updates (200 { ok: true, ignored: true })
 * 4. Handles the message through the bot
 * 5. Returns 200 { ok: true }
 */
export function createWebhookRoutes(container: AppContainer): WebhookRoute[] {
	const webhooks: WebhookConfig[] = [];
	if (container.config.telegram) {
		webhooks.push({
			platform: PlatformCode.Telegram,
			path: 'telegram',
			secret: container.config.telegram.webhookSecret,
			botScope: container.config.telegram.botScope,
		});
	}
	if (container.config.bale) {
		webhooks.push({
			platform: PlatformCode.Bale,
			path: 'bale',
			secret: container.config.bale.webhookSecret,
			botScope: container.config.bale.botScope,
		});
	}

	return webhooks.map((webhook) => {
		const handler = async (
			request: Request,
			response: Response,
		): Promise<void> => {
			if (webhook.secret) {
				const provided =
					request.header('x-telegram-bot-api-secret-token') ??
					request.header('x-webhook-secret');
				if (provided !== webhook.secret) {
					response.status(401).json({
						ok: false,
						error: 'INVALID_WEBHOOK_SECRET',
					});
					return;
				}
			}

			const botScope = webhook.botScope ?? '';
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
		};

		return { path: webhook.path, handler };
	});
}
