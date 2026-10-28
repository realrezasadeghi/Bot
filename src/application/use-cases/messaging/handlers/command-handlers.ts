import type { OutboundMessage } from '../../../../application/dto/messaging.js';
import type { AcademicTerm } from '../../../../domain/academic/entities.js';
import type { ProgramCourseDto } from '../../subscriptions/get-subscription.js';
import type {
	CommandContext,
	CommandHandler,
	HandlerDeps,
} from './handler-deps.js';

export type { CommandContext, CommandHandler };

export class StartCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		await this.deps.stateStore.clear({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		return this.deps.renderer.welcome(context.recipient);
	}
}

export class MenuCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		await this.deps.stateStore.clear({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		return this.deps.renderer.mainMenu(context.recipient);
	}
}

export class HelpCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		return this.deps.renderer.help(context.recipient);
	}
}

export class CancelCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		await this.deps.stateStore.clear({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		return this.deps.renderer.mainMenu(context.recipient);
	}
}

export class TodayCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const schedule = await this.deps.getDailySchedule.execute(context.userId);
		return this.deps.renderer.dailySchedule(schedule, context.recipient);
	}
}

export class WeekCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const schedule = await this.deps.getWeeklySchedule.execute(context.userId);
		return this.deps.renderer.weeklySchedule(schedule, context.recipient);
	}
}

export class ExamsCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const examinations = await this.deps.getUpcomingExaminations.execute(
			context.userId,
		);
		return this.deps.renderer.examinations(examinations, context.recipient);
	}
}

export class ProgramCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const subscription = await this.deps.getCurrentSubscription.execute(
			context.userId,
		);
		return this.deps.renderer.subscription(subscription, context.recipient);
	}
}

export class PrefsCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const selection = await this.deps.uow.run((repositories) =>
			repositories.studentSelections.findActiveByUserId(context.userId),
		);
		if (selection) {
			return this.deps.renderer.studentPreferences(selection, context.recipient);
		}
		const subscription = await this.deps.getCurrentSubscription.execute(
			context.userId,
		);
		if (!subscription) {
			return this.deps.renderer.needSubscription(context.recipient);
		}
		return this.deps.renderer.preferences(subscription, context.recipient);
	}
}

export class CustomizeCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const courses = await this.deps.getProgramCourses.execute(context.userId);
		if (!courses) {
			return this.deps.renderer.needSubscription(context.recipient);
		}
		const selected = new Set(
			courses.courses
				.filter((course: ProgramCourseDto) => course.selected)
				.map((course: ProgramCourseDto) => course.courseOfferingId),
		);
		await this.deps.stateStore.set({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
			step: 'CUSTOMIZE',
			data: { selectedCourseOfferingIds: [...selected].join(',') },
			updatedAt: new Date(),
			expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
		});
		return this.deps.renderer.programCourses(
			courses,
			selected,
			context.recipient,
		);
	}
}

export class UnsubscribeCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const subscription = await this.deps.getCurrentSubscription.execute(
			context.userId,
		);
		if (!subscription) {
			return this.deps.renderer.needSubscription(context.recipient);
		}
		return this.deps.renderer.unsubscribeConfirm(
			subscription.programTitle,
			context.recipient,
		);
	}
}

export class TermsCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		const terms = await this.deps.getAvailableTerms.execute();
		return {
			recipient: context.recipient,
			text:
				terms.length === 0
					? 'هنوز ترمی از منبع دانشگاه وارد نشده است.'
					: [
							'ترم‌های موجود:',
							...terms.map(
								(term: AcademicTerm) =>
									`- ${term.title} (${term.externalCode})${term.isActive ? '' : ' - غیرInactive'}`,
							),
						].join('\n'),
			buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
		};
	}
}

export class SubscribeCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		await this.deps.stateStore.clear({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		const [terms, levels] = await Promise.all([
			this.deps.getAvailableTerms.execute(),
			this.deps.getAvailableLevels.execute(),
		]);

		if (terms.length === 0) {
			return {
				recipient: context.recipient,
				text: 'هنوز داده‌ای از منبع دانشگاه وارد نشده است. لطفاً بعداً تلاش کنید.',
				buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
			};
		}
		if (levels.length === 0) {
			return this.deps.renderer.unresolvedProgramGrouping(context.recipient);
		}
		return this.deps.renderer.levels(levels, context.recipient);
	}
}

export class StudyCommandHandler implements CommandHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CommandContext): Promise<OutboundMessage | null> {
		await this.deps.stateStore.clear({
			userId: context.userId,
			platform: context.event.platform,
			botScope: context.event.botScope,
		});
		const [terms, levels] = await Promise.all([
			this.deps.getAvailableTerms.execute(),
			this.deps.getAvailableLevels.execute(),
		]);

		if (terms.length === 0) {
			return {
				recipient: context.recipient,
				text: 'هنوز ترمی از منبع دانشگاه وارد نشده است.',
				buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
			};
		}
		if (levels.length === 0) {
			return this.deps.renderer.unresolvedProgramGrouping(context.recipient);
		}
		return this.deps.renderer.studyLevels(levels, context.recipient);
	}
}
