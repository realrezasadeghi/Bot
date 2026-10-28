import type { IncomingPlatformEvent } from '../../../application/dto/incoming.js';
import type {
	OutboundMessage,
	OutboundRecipient,
} from '../../../application/dto/messaging.js';
import type {
	CallbackContext,
	CallbackHandler,
	CallbackPayload,
} from './handlers/handler-deps.js';

export type { CallbackContext, CallbackHandler, CallbackPayload };

export interface CallbackRoute {
	action: string;
	handler: CallbackHandler;
}

export class CallbackRouter {
	private readonly routes = new Map<string, CallbackHandler>();

	constructor(routes: ReadonlyArray<CallbackRoute> = []) {
		for (const route of routes) {
			this.register(route.action, route.handler);
		}
	}

	register(action: string, handler: CallbackHandler): void {
		if (action.trim().length === 0) {
			throw new Error('CallbackRouter requires a non-empty action');
		}
		this.routes.set(action, handler);
	}

	async execute(context: {
		userId: string;
		event: IncomingPlatformEvent;
		recipient: OutboundRecipient;
		callbackData: string;
	}): Promise<OutboundMessage | null> {
		const payload = parseCallback(context.callbackData);
		if (!payload) return null;
		const handler = this.routes.get(payload.action);
		if (!handler) return null;
		return handler.execute({
			userId: context.userId,
			event: context.event,
			recipient: context.recipient,
			payload,
		});
	}
}

export function parseCallback(callbackData: string): CallbackPayload | null {
	const colonIndex = callbackData.indexOf(':');
	if (colonIndex === -1) {
		return { action: callbackData, rest: '', params: [] };
	}
	const action = callbackData.slice(0, colonIndex);
	const rest = callbackData.slice(colonIndex + 1);
	return { action, rest, params: rest.split(':') };
}
