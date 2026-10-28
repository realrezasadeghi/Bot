import type { IncomingPlatformEvent } from '../../../application/dto/incoming.js';
import type {
	OutboundMessage,
	OutboundRecipient,
} from '../../../application/dto/messaging.js';
import type { ConversationStateStore } from '../../../application/ports/outbound/conversation-state-store.js';
import type {
	CommandContext,
	CommandHandler,
} from './handlers/handler-deps.js';

export type { CommandContext, CommandHandler };

export interface CommandRoute {
	command: string;
	handler: CommandHandler;
}

export class CommandRouter {
	private readonly routes = new Map<string, CommandHandler>();

	constructor(routes: ReadonlyArray<CommandRoute> = []) {
		for (const route of routes) {
			this.register(route.command, route.handler);
		}
	}

	register(command: string, handler: CommandHandler): void {
		if (command.trim().length === 0) {
			throw new Error('CommandRouter requires a non-empty command name');
		}
		this.routes.set(command, handler);
	}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const handler = this.routes.get(context.command);
		if (!handler) return null;
		return handler.execute(context);
	}
}

export class StateHelper {
	constructor(
		private readonly stateStore: ConversationStateStore,
		private readonly ttlMs: number,
	) {}

	async clear(context: {
		userId: string;
		event: IncomingPlatformEvent;
	}): Promise<void> {
		await this.stateStore.clear({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
	}

	async save(
		context: {
			userId: string;
			event: IncomingPlatformEvent;
		},
		step: string,
		data: Readonly<Record<string, string>>,
	): Promise<void> {
		const now = new Date();
		await this.stateStore.set({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
			step,
			data,
			updatedAt: now,
			expiresAt: new Date(now.getTime() + this.ttlMs),
		});
	}

	async get(context: { userId: string; event: IncomingPlatformEvent }) {
		return this.stateStore.get({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
	}
}

export function recipientOf(event: IncomingPlatformEvent): OutboundRecipient {
	return {
		platform: event.platform,
		botScope: event.botScope,
		externalUserId: event.externalUserId,
		externalChatId: event.externalChatId,
	};
}
