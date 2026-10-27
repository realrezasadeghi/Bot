import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type {
	ConversationState,
	ConversationStateStore,
} from '../../../../application/ports/outbound/conversation-state-store.js';
import type { PlatformCode } from '../../../../domain/identity/platform-identity.js';
import type { AppDatabase } from './db.js';
import { conversationStates } from './schema.js';

export class PostgresConversationStateStore implements ConversationStateStore {
	constructor(private readonly db: AppDatabase) {}

	async get(input: {
		userId: string;
		platform: PlatformCode;
		botScope: string;
	}): Promise<ConversationState | null> {
		const [row] = await this.db
			.select()
			.from(conversationStates)
			.where(
				and(
					eq(conversationStates.userId, input.userId),
					eq(conversationStates.platform, input.platform),
					eq(conversationStates.botScope, input.botScope),
					gt(conversationStates.expiresAt, new Date()),
				),
			)
			.limit(1);

		if (!row) return null;
		return {
			userId: row.userId,
			platform: row.platform as PlatformCode,
			botScope: row.botScope,
			step: row.step,
			data: row.data,
			updatedAt: row.updatedAt,
			expiresAt: row.expiresAt,
		};
	}

	async set(state: ConversationState): Promise<void> {
		await this.db
			.insert(conversationStates)
			.values({
				id: randomUUID(),
				userId: state.userId,
				platform: state.platform,
				botScope: state.botScope,
				step: state.step,
				data: { ...state.data },
				updatedAt: state.updatedAt,
				expiresAt: state.expiresAt,
			})
			.onConflictDoUpdate({
				target: [
					conversationStates.userId,
					conversationStates.platform,
					conversationStates.botScope,
				],
				set: {
					step: state.step,
					data: { ...state.data },
					updatedAt: state.updatedAt,
					expiresAt: state.expiresAt,
				},
			});
	}

	async clear(input: {
		userId: string;
		platform: PlatformCode;
		botScope: string;
	}): Promise<void> {
		await this.db
			.delete(conversationStates)
			.where(
				and(
					eq(conversationStates.userId, input.userId),
					eq(conversationStates.platform, input.platform),
					eq(conversationStates.botScope, input.botScope),
				),
			);
	}
}
