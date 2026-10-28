import type { IncomingPlatformEvent } from '../../dto/incoming.js';
import type {
	OutboundMessage,
	OutboundRecipient,
} from '../../dto/messaging.js';
import type { BotRenderer } from '../../ports/outbound/bot-renderer.js';
import { CallbackRouter } from './callback-router.js';
import { CommandRouter } from './command-router.js';
import {
	FieldCallbackHandler,
	LevelCallbackHandler,
	MenuCallbackHandler,
	NoopCallbackHandler,
	ProgramCallbackHandler,
	TermCallbackHandler,
} from './handlers/callback-handlers.js';
import {
	CancelCommandHandler,
	CustomizeCommandHandler,
	ExamsCommandHandler,
	HelpCommandHandler,
	MenuCommandHandler,
	PrefsCommandHandler,
	ProgramCommandHandler,
	StartCommandHandler,
	StudyCommandHandler,
	SubscribeCommandHandler,
	TermsCommandHandler,
	TodayCommandHandler,
	UnsubscribeCommandHandler,
	WeekCommandHandler,
} from './handlers/command-handlers.js';
import type {
	HandlerDeps,
	IncomingMessageDependencies,
} from './handlers/handler-deps.js';
import {
	CourseCallbackHandler,
	PreferenceCallbackHandler,
	StudentPreferenceCallbackHandler,
	UnsubscribeCallbackHandler,
} from './handlers/preference-callback-handler.js';
import { StudySelectionCallbackHandler } from './handlers/study-selection-callback-handler.js';

const PERSIAN_COMMAND_ALIASES: Record<string, string> = {
	امروز: 'today',
	هفتگی: 'week',
	امتحانات: 'exams',
	امتحان: 'exams',
	رشته: 'study',
	رشته‌ها: 'study',
	برنامه: 'program',
	راهنما: 'help',
	تنظیمات: 'prefs',
	منو: 'menu',
	انتخاب: 'subscribe',
	لغو: 'unsubscribe',
};

export interface HandleIncomingMessageOptions {
	dependencies: IncomingMessageDependencies;
	renderer: BotRenderer;
}

export class HandleIncomingPlatformMessage {
	private readonly commandRouter: CommandRouter;
	private readonly callbackRouter: CallbackRouter;

	constructor(private readonly deps: HandleIncomingMessageOptions) {
		const handlerDeps: HandlerDeps = {
			...deps.dependencies,
			renderer: deps.renderer,
		} as HandlerDeps;

		const commandRouter = new CommandRouter([
			{ command: 'start', handler: new StartCommandHandler(handlerDeps) },
			{ command: 'menu', handler: new MenuCommandHandler(handlerDeps) },
			{ command: 'help', handler: new HelpCommandHandler(handlerDeps) },
			{ command: 'cancel', handler: new CancelCommandHandler(handlerDeps) },
			{ command: 'today', handler: new TodayCommandHandler(handlerDeps) },
			{ command: 'week', handler: new WeekCommandHandler(handlerDeps) },
			{ command: 'exams', handler: new ExamsCommandHandler(handlerDeps) },
			{ command: 'program', handler: new ProgramCommandHandler(handlerDeps) },
			{ command: 'prefs', handler: new PrefsCommandHandler(handlerDeps) },
			{ command: 'customize', handler: new CustomizeCommandHandler(handlerDeps) },
			{
				command: 'unsubscribe',
				handler: new UnsubscribeCommandHandler(handlerDeps),
			},
			{ command: 'terms', handler: new TermsCommandHandler(handlerDeps) },
			{ command: 'subscribe', handler: new SubscribeCommandHandler(handlerDeps) },
			{ command: 'study', handler: new StudyCommandHandler(handlerDeps) },
		]);

		handlerDeps.commandRouter = commandRouter;
		this.commandRouter = commandRouter;

		this.callbackRouter = new CallbackRouter([
			{ action: 'menu', handler: new MenuCallbackHandler(handlerDeps) },
			{ action: 'level', handler: new LevelCallbackHandler(handlerDeps) },
			{ action: 'field', handler: new FieldCallbackHandler(handlerDeps) },
			{ action: 'term', handler: new TermCallbackHandler(handlerDeps) },
			{ action: 'program', handler: new ProgramCallbackHandler(handlerDeps) },
			{ action: 'sf', handler: new StudySelectionCallbackHandler(handlerDeps) },
			{
				action: 'spref',
				handler: new StudentPreferenceCallbackHandler(handlerDeps),
			},
			{ action: 'pref', handler: new PreferenceCallbackHandler(handlerDeps) },
			{ action: 'course', handler: new CourseCallbackHandler(handlerDeps) },
			{
				action: 'unsubscribe',
				handler: new UnsubscribeCallbackHandler(handlerDeps),
			},
			{ action: 'noop', handler: new NoopCallbackHandler() },
		]);
	}

	async execute(event: IncomingPlatformEvent): Promise<OutboundMessage | null> {
		const { user } =
			await this.deps.dependencies.registerOrResolveUser.execute(event);
		const recipient = recipientOf(event);

		if (event.callbackData) {
			const result = await this.callbackRouter.execute({
				userId: user.id,
				event,
				recipient,
				callbackData: event.callbackData,
			});
			return result ?? this.deps.renderer.mainMenu(recipient);
		}

		const text = event.text?.trim();
		if (!text) return null;

		const command = this.parseCommand(text);
		const result = await this.commandRouter.execute({
			command,
			userId: user.id,
			event,
			recipient,
		});
		if (result) return result;
		return {
			recipient,
			text: 'دستور نامعتبر است. از منوی زیر استفاده کنید.',
			buttons: this.deps.renderer.mainMenu(recipient).buttons,
		};
	}

	private parseCommand(text: string): string {
		if (text.startsWith('/')) {
			return text.slice(1).split(/\s+/)[0]?.split('@')[0]?.toLowerCase() ?? '';
		}
		return PERSIAN_COMMAND_ALIASES[text] ?? 'unknown';
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
