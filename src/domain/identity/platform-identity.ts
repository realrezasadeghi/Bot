import { ValidationError } from '../shared/errors.js';

export enum PlatformCode {
	Telegram = 'TELEGRAM',
	Bale = 'BALE',
}

export function isPlatformCode(value: string): value is PlatformCode {
	return (Object.values(PlatformCode) as string[]).includes(value);
}

export class PlatformIdentity {
	private constructor(
		readonly id: string,
		readonly userId: string,
		readonly platform: PlatformCode,
		readonly botScope: string,
		readonly externalUserId: string,
		readonly externalChatId: string | null,
		readonly username: string | null,
		readonly createdAt: Date,
		readonly updatedAt: Date,
	) {}

	static create(input: {
		id: string;
		userId: string;
		platform: PlatformCode;
		botScope: string;
		externalUserId: string;
		externalChatId?: string | null;
		username?: string | null;
		createdAt?: Date;
		updatedAt?: Date;
	}): PlatformIdentity {
		if (!input.id.trim())
			throw new ValidationError('PlatformIdentity.id is required');
		if (!input.userId.trim()) {
			throw new ValidationError('PlatformIdentity.userId is required');
		}
		if (!input.botScope.trim()) {
			throw new ValidationError('PlatformIdentity.botScope is required');
		}
		if (!input.externalUserId.trim()) {
			throw new ValidationError('PlatformIdentity.externalUserId is required');
		}

		const now = new Date();
		return new PlatformIdentity(
			input.id.trim(),
			input.userId.trim(),
			input.platform,
			input.botScope.trim(),
			input.externalUserId.trim(),
			input.externalChatId?.trim() || null,
			input.username?.trim() || null,
			input.createdAt ?? now,
			input.updatedAt ?? input.createdAt ?? now,
		);
	}
}
