import { z } from 'zod';

/**
 * Incoming Telegram-compatible update.
 *
 * Deliberately permissive: the concrete payload is defined by Telegram/Bale,
 * not by this service. Rejecting unknown fields would drop valid platform
 * updates.
 */
export const WebhookUpdateSchema = z.record(z.string(), z.unknown()).meta({
	id: 'WebhookUpdate',
	description:
		'Platform-defined Telegram-compatible update object (message or callback_query).',
	example: {
		update_id: 1,
		message: {
			message_id: 1,
			from: { id: 1, first_name: 'User' },
			chat: { id: 1, type: 'private' },
			text: '/start',
			date: 1_760_000_000,
		},
	},
});

/** Successful webhook acknowledgement. */
export const WebhookSuccessSchema = z
	.object({
		ok: z.literal(true),
	})
	.meta({ id: 'WebhookSuccess' });

/** Acknowledgement for updates without actionable content. */
export const WebhookIgnoredSchema = z
	.object({
		ok: z.literal(true),
		ignored: z.literal(true),
	})
	.meta({ id: 'WebhookIgnored' });

/** Returned when the configured webhook secret does not match. */
export const WebhookUnauthorizedSchema = z
	.object({
		ok: z.literal(false),
		error: z.literal('INVALID_WEBHOOK_SECRET'),
	})
	.meta({ id: 'WebhookUnauthorized' });

export type WebhookSuccess = z.infer<typeof WebhookSuccessSchema>;
export type WebhookIgnored = z.infer<typeof WebhookIgnoredSchema>;
export type WebhookUnauthorized = z.infer<typeof WebhookUnauthorizedSchema>;
