import type { OutboundMessage } from '../../../../application/dto/messaging.js';
import type {
	CallbackContext,
	CallbackHandler,
	HandlerDeps,
} from './handler-deps.js';

export type { CallbackContext, CallbackHandler };

export class MenuCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const target = context.payload.rest || 'menu';
		const command = target === 'home' ? 'menu' : target;
		return this.deps.commandRouter.execute({
			command,
			userId: context.userId,
			event: context.event,
			recipient: context.recipient,
		});
	}
}

export class LevelCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const levelId = context.payload.params[0];
		if (!levelId) {
			return this.deps.renderer.mainMenu(context.recipient);
		}
		const fields = await this.deps.getAvailableFields.execute(levelId);
		if (fields.length === 0) {
			return {
				recipient: context.recipient,
				text: 'برای این مقطع رشته‌ای در منبع دانشگاه پیدا نشد.',
				buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
			};
		}
		await this.deps.stateStore.set({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
			step: 'SELECT_FIELD',
			data: { levelId },
			updatedAt: new Date(),
			expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
		});
		return this.deps.renderer.fields(fields, context.recipient);
	}
}

export class FieldCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const fieldId = context.payload.params[0];
		const state = await this.deps.stateStore.get({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		if (!fieldId || !state?.data.levelId) {
			return this.deps.renderer.restartFlow(context.recipient);
		}
		const terms = await this.deps.getAvailableTerms.execute();
		await this.deps.stateStore.set({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
			step: 'SELECT_TERM',
			data: { levelId: state.data.levelId, fieldId },
			updatedAt: new Date(),
			expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
		});
		return this.deps.renderer.terms(terms, context.recipient);
	}
}

export class TermCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const termId = context.payload.params[0];
		const state = await this.deps.stateStore.get({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		if (!termId || !state?.data.levelId || !state.data.fieldId) {
			return this.deps.renderer.restartFlow(context.recipient);
		}

		const programs = await this.deps.getAvailablePrograms.execute({
			termId,
			levelId: state.data.levelId,
			fieldOfStudyId: state.data.fieldId,
		});
		if (programs.length === 0) {
			await this.deps.stateStore.clear({
				userId: context.userId,
				platform: context.event.platform,
				botScope: context.event.botScope,
			});
			return this.deps.renderer.unresolvedProgramGrouping(context.recipient);
		}

		await this.deps.stateStore.set({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
			step: 'SELECT_PROGRAM',
			data: {
				levelId: state.data.levelId,
				fieldId: state.data.fieldId,
				termId,
			},
			updatedAt: new Date(),
			expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
		});
		return this.deps.renderer.programs(programs, context.recipient);
	}
}

export class ProgramCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const programOfferingId = context.payload.params[0];
		if (!programOfferingId) {
			return this.deps.renderer.restartFlow(context.recipient);
		}
		const subscription = await this.deps.subscribeToProgram.execute(
			context.userId,
			programOfferingId,
		);
		await this.deps.stateStore.clear({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		return {
			recipient: context.recipient,
			text: [
				'ثبت‌نام انجام شد.',
				`برنامه: ${subscription.programTitle}`,
				`ترم: ${subscription.termTitle}`,
				'',
				'اکنون می‌توانید برنامه امروز یا هفتگی خود را ببینید.',
			].join('\n'),
			buttons: this.deps.renderer.mainMenu(context.recipient).buttons,
		};
	}
}

export class NoopCallbackHandler implements CallbackHandler {
	async execute(): Promise<OutboundMessage | null> {
		return null;
	}
}

export class DefaultCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		return this.deps.renderer.mainMenu(context.recipient);
	}
}
