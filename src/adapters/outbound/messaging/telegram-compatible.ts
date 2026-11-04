import type {
	OutboundMessage,
	SendMessageResult,
} from '../../../application/dto/messaging.js';
import type { MessagingPort } from '../../../application/ports/outbound/messaging.js';
import { PlatformCode } from '../../../domain/identity/platform-identity.js';

export interface TelegramCompatibleConfig {
	platform: PlatformCode;
	token: string;
	apiBaseUrl: string;
	requestTimeoutMs?: number;
}

interface TelegramApiResponse {
	ok?: boolean;
	result?: { message_id?: number | string };
	description?: string;
	error_code?: number;
	parameters?: { retry_after?: number };
}

function providerOf(platform: PlatformCode): string {
	return platform === PlatformCode.Telegram ? 'telegram' : 'bale';
}

function toInlineKeyboard(message: OutboundMessage) {
	if (message.buttons.length === 0) return undefined;
	return {
		inline_keyboard: message.buttons.map((row) =>
			row.map((button) => ({
				text: button.text,
				callback_data: button.callbackData,
			})),
		),
	};
}

export class TelegramCompatibleMessagingAdapter implements MessagingPort {
	constructor(private readonly config: TelegramCompatibleConfig) {}

	async send(message: OutboundMessage): Promise<SendMessageResult> {
		const provider = providerOf(this.config.platform);
		const url = `${this.config.apiBaseUrl.replace(/\/+$/, '')}/bot${
			this.config.token
		}/sendMessage`;

		try {
			const chatId = message.recipient.externalChatId ?? message.recipient.externalUserId;
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					chat_id: chatId,
					text: message.text,
					reply_markup: toInlineKeyboard(message),
				}),
				signal: AbortSignal.timeout(this.config.requestTimeoutMs ?? 15_000),
			});

			const payload = (await response
				.json()
				.catch(() => null)) as TelegramApiResponse | null;

			const retryAfterSeconds = payload?.parameters?.retry_after;
			const retryAfterMs =
				typeof retryAfterSeconds === 'number'
					? Math.max(0, retryAfterSeconds * 1_000)
					: null;

			if (!response.ok || payload?.ok === false) {
				const retryable = response.status === 429 || response.status >= 500;
				const errorMessage =
					payload?.description ??
					`Messaging provider returned HTTP ${response.status}`;
				return {
					provider,
					retryable,
					retryAfterMs,
					delivered: false,
					error: errorMessage,
					providerMessageId: null,
				};
			}

			const messageId = payload?.result?.message_id;
			return {
				provider,
				error: null,
				delivered: true,
				retryable: false,
				retryAfterMs: null,
				providerMessageId: messageId === undefined ? null : String(messageId),
			};
		} catch (error) {
			return {
				provider,
				retryable: true,
				delivered: false,
				retryAfterMs: null,
				providerMessageId: null,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
