import type { IncomingPlatformEvent } from '../../application/dto/incoming.js';
import type { PlatformCode } from '../../domain/identity/platform-identity.js';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as JsonRecord)
		: null;
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function asId(value: unknown): string | null {
	if (typeof value === 'string' && value.length > 0) return value;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return null;
}

function displayNameOf(user: JsonRecord): string | null {
	const parts = [asString(user.first_name), asString(user.last_name)].filter(
		(part): part is string => part !== null,
	);
	if (parts.length > 0) return parts.join(' ');
	return asString(user.username);
}

export function parseTelegramCompatibleUpdate(input: {
	update: unknown;
	platform: PlatformCode;
	botScope: string;
}): IncomingPlatformEvent | null {
	const update = asRecord(input.update);
	if (!update) return null;

	const message = asRecord(update.message) ?? asRecord(update.edited_message);
	const callback = asRecord(update.callback_query);
	const callbackMessage = asRecord(callback?.message);

	const from = asRecord(message?.from) ?? asRecord(callback?.from);
	if (!from) return null;

	const externalUserId = asId(from.id);
	if (!externalUserId) return null;

	const chat = asRecord(message?.chat) ?? asRecord(callbackMessage?.chat);
	const externalChatId = asId(chat?.id) ?? externalUserId;

	const text = asString(message?.text) ?? asString(message?.caption);
	const callbackData = asString(callback?.data);

	if (!text && !callbackData) return null;

	const externalMessageId =
		asId(message?.message_id) ??
		asId(callbackMessage?.message_id) ??
		asId(callback?.id);

	return {
		platform: input.platform,
		botScope: input.botScope,
		externalUserId,
		externalChatId,
		externalMessageId,
		username: asString(from.username),
		displayName: displayNameOf(from),
		localeHint: asString(from.language_code),
		kind: callbackData ? 'CALLBACK' : 'MESSAGE',
		text,
		callbackData,
		receivedAt: new Date(),
	};
}
