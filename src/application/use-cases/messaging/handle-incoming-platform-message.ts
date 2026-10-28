import type { IncomingPlatformEvent } from '../../dto/incoming.js';
import type {
	OutboundMessage,
	OutboundRecipient,
} from '../../dto/messaging.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { ConversationStateStore } from '../../ports/outbound/conversation-state-store.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';
import {
	type BotContent,
	renderCourseOfferings,
	renderDailySchedule,
	renderExaminations,
	renderFields,
	renderHelp,
	renderLevels,
	renderMainMenu,
	renderPreferences,
	renderProgramCourses,
	renderPrograms,
	renderStudentPreferences,
	renderStudyFields,
	renderStudyLevels,
	renderStudyTerms,
	renderSubscription,
	renderTerms,
	renderUnresolvedProgramGrouping,
	renderWeeklySchedule,
	renderWelcome,
} from '../../services/bot-messages.js';
import type {
	GetAvailableFields,
	GetAvailableLevels,
	GetAvailablePrograms,
} from '../academic/get-academic-options.js';
import type { GetAvailableCourseOfferings } from '../academic/get-available-course-offerings.js';
import type { GetAvailableTerms } from '../academic/get-available-terms.js';
import type { GetStudyFields } from '../academic/get-study-fields.js';
import type { GetUpcomingExaminations } from '../academic/get-upcoming-examinations.js';
import type { SaveStudentCourseSelection } from '../academic/save-student-course-selection.js';
import type { UpdateStudentNotificationPreferences } from '../academic/update-student-notification-preferences.js';
import type { RegisterOrResolveUser } from '../identity/register-or-resolve-user.js';
import type {
	GetDailySchedule,
	GetWeeklySchedule,
} from '../scheduling/get-schedules.js';
import type {
	CustomizeCourseSelection,
	FollowProgramDefault,
} from '../subscriptions/customize-course-selection.js';
import type {
	GetCurrentSubscription,
	GetProgramCourses,
} from '../subscriptions/get-subscription.js';
import type { SubscribeToProgram } from '../subscriptions/subscribe-to-program.js';
import type { UnsubscribeFromProgram } from '../subscriptions/unsubscribe-from-program.js';
import type {
	NotificationPreferenceChanges,
	UpdateNotificationPreferences,
} from '../subscriptions/update-notification-preferences.js';

const STATE_TTL_MS = 30 * 60 * 1_000;

export interface IncomingMessageDependencies {
	uow: UnitOfWork;
	clock: Clock;
	logger: Logger;
	stateStore: ConversationStateStore;
	registerOrResolveUser: RegisterOrResolveUser;
	getAvailableTerms: GetAvailableTerms;
	getAvailableLevels: GetAvailableLevels;
	getAvailableFields: GetAvailableFields;
	getAvailablePrograms: GetAvailablePrograms;
	getDailySchedule: GetDailySchedule;
	getWeeklySchedule: GetWeeklySchedule;
	getUpcomingExaminations: GetUpcomingExaminations;
	getStudyFields: GetStudyFields;
	getAvailableCourseOfferings: GetAvailableCourseOfferings;
	saveStudentCourseSelection: SaveStudentCourseSelection;
	updateStudentNotificationPreferences: UpdateStudentNotificationPreferences;
	getCurrentSubscription: GetCurrentSubscription;
	getProgramCourses: GetProgramCourses;
	subscribeToProgram: SubscribeToProgram;
	customizeCourseSelection: CustomizeCourseSelection;
	followProgramDefault: FollowProgramDefault;
	updateNotificationPreferences: UpdateNotificationPreferences;
	unsubscribeFromProgram: UnsubscribeFromProgram;
}

export class HandleIncomingPlatformMessage {
	constructor(private readonly deps: IncomingMessageDependencies) {}

	async execute(event: IncomingPlatformEvent): Promise<OutboundMessage | null> {
		const { user } = await this.deps.registerOrResolveUser.execute(event);
		const recipient = this.recipientOf(event);

		if (event.callbackData) {
			return this.handleCallback(user.id, event, recipient, event.callbackData);
		}

		const text = event.text?.trim();
		if (!text) return null;

		const command = this.parseCommand(text);
		return this.handleCommand(user.id, event, recipient, command);
	}

	private parseCommand(text: string): string {
		if (text.startsWith('/')) {
			return text.slice(1).split(/\s+/)[0]?.split('@')[0]?.toLowerCase() ?? '';
		}

		const aliases: Record<string, string> = {
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

		return aliases[text] ?? 'unknown';
	}

	private async handleCommand(
		userId: string,
		event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
		command: string,
	): Promise<OutboundMessage | null> {
		switch (command) {
			case 'start':
				await this.clearState(userId, event);
				return this.toMessage(renderWelcome(), recipient);

			case 'menu':
				await this.clearState(userId, event);
				return this.toMessage(renderMainMenu(), recipient);

			case 'help':
				return this.toMessage(renderHelp(), recipient);

			case 'today': {
				const schedule = await this.deps.getDailySchedule.execute(userId);
				return this.toMessage(renderDailySchedule(schedule), recipient);
			}

			case 'week': {
				const schedule = await this.deps.getWeeklySchedule.execute(userId);
				return this.toMessage(renderWeeklySchedule(schedule), recipient);
			}

			case 'exams': {
				const examinations =
					await this.deps.getUpcomingExaminations.execute(userId);
				return this.toMessage(renderExaminations(examinations), recipient);
			}

			case 'program': {
				const subscription = await this.deps.getCurrentSubscription.execute(userId);
				return this.toMessage(renderSubscription(subscription), recipient);
			}

			case 'prefs': {
				const selection = await this.deps.uow.run((repositories) =>
					repositories.studentSelections.findActiveByUserId(userId),
				);
				if (selection) {
					return this.toMessage(
						renderStudentPreferences(selection),
						recipient,
					);
				}
				const subscription = await this.deps.getCurrentSubscription.execute(userId);
				if (!subscription) {
					return this.toMessage(this.needSubscriptionContent(), recipient);
				}
				return this.toMessage(renderPreferences(subscription), recipient);
			}

			case 'customize': {
				const courses = await this.deps.getProgramCourses.execute(userId);
				if (!courses) {
					return this.toMessage(this.needSubscriptionContent(), recipient);
				}
				const selected = new Set(
					courses.courses
						.filter((course) => course.selected)
						.map((course) => course.courseOfferingId),
				);
				await this.saveState(userId, event, 'CUSTOMIZE', {
					selectedCourseOfferingIds: [...selected].join(','),
				});
				return this.toMessage(renderProgramCourses(courses, selected), recipient);
			}

			case 'unsubscribe': {
				const subscription = await this.deps.getCurrentSubscription.execute(userId);
				if (!subscription) {
					return this.toMessage(this.needSubscriptionContent(), recipient);
				}
				return this.toMessage(
					{
						text: `آیا از برنامه «${subscription.programTitle}» لغو اشتراک می‌کنید؟`,
						buttons: [
							[
								{
									text: 'بله، لغو اشتراک',
									callbackData: 'unsubscribe:confirm',
								},
								{ text: 'انصراف', callbackData: 'unsubscribe:cancel' },
							],
						],
					},
					recipient,
				);
			}

			case 'terms': {
				const terms = await this.deps.getAvailableTerms.execute();
				return this.toMessage(
					{
						text:
							terms.length === 0
								? 'هنوز ترمی از منبع دانشگاه وارد نشده است.'
								: [
										'ترم‌های موجود:',
										...terms.map(
											(term) =>
												`- ${term.title} (${term.externalCode})${term.isActive ? '' : ' - غیرفعال'}`,
										),
									].join('\n'),
						buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
					},
					recipient,
				);
			}

			case 'subscribe':
				return this.startSubscriptionFlow(userId, event, recipient);

			case 'study':
				return this.startStudySelectionFlow(userId, event, recipient);

			case 'cancel':
				await this.clearState(userId, event);
				return this.toMessage(renderMainMenu(), recipient);

			default:
				return this.toMessage(
					{
						text: 'دستور نامعتبر است. از منوی زیر استفاده کنید.',
						buttons: renderMainMenu().buttons,
					},
					recipient,
				);
		}
	}

	private async handleCallback(
		userId: string,
		event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
		callbackData: string,
	): Promise<OutboundMessage | null> {
		const [action, ...rest] = callbackData.split(':');

		if (action === 'menu') {
			const target = rest.join(':') || 'menu';
			return this.handleCommand(
				userId,
				event,
				recipient,
				target === 'home' ? 'menu' : target,
			);
		}

		if (action === 'level') {
			const levelId = rest[0];
			if (!levelId) return this.toMessage(renderMainMenu(), recipient);
			const fields = await this.deps.getAvailableFields.execute(levelId);
			if (fields.length === 0) {
				return this.toMessage(
					{
						text: 'برای این مقطع رشته‌ای در منبع دانشگاه پیدا نشد.',
						buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
					},
					recipient,
				);
			}
			await this.saveState(userId, event, 'SELECT_FIELD', { levelId });
			return this.toMessage(renderFields(fields), recipient);
		}

		if (action === 'field') {
			const fieldId = rest[0];
			const state = await this.getState(userId, event);
			if (!fieldId || !state?.data.levelId) {
				return this.toMessage(this.restartFlowContent(), recipient);
			}
			const terms = await this.deps.getAvailableTerms.execute();
			await this.saveState(userId, event, 'SELECT_TERM', {
				levelId: state.data.levelId,
				fieldId,
			});
			return this.toMessage(renderTerms(terms), recipient);
		}

		if (action === 'term') {
			const termId = rest[0];
			const state = await this.getState(userId, event);
			if (!termId || !state?.data.levelId || !state.data.fieldId) {
				return this.toMessage(this.restartFlowContent(), recipient);
			}

			const programs = await this.deps.getAvailablePrograms.execute({
				termId,
				levelId: state.data.levelId,
				fieldOfStudyId: state.data.fieldId,
			});
			if (programs.length === 0) {
				await this.clearState(userId, event);
				return this.toMessage(renderUnresolvedProgramGrouping(), recipient);
			}

			await this.saveState(userId, event, 'SELECT_PROGRAM', {
				levelId: state.data.levelId,
				fieldId: state.data.fieldId,
				termId,
			});
			return this.toMessage(renderPrograms(programs), recipient);
		}

		if (action === 'program') {
			const programOfferingId = rest[0];
			if (!programOfferingId) {
				return this.toMessage(this.restartFlowContent(), recipient);
			}
			const subscription = await this.deps.subscribeToProgram.execute(
				userId,
				programOfferingId,
			);
			await this.clearState(userId, event);
			return this.toMessage(
				{
					text: [
						'ثبت‌نام انجام شد.',
						`برنامه: ${subscription.programTitle}`,
						`ترم: ${subscription.termTitle}`,
						'',
						'اکنون می‌توانید برنامه امروز یا هفتگی خود را ببینید.',
					].join('\n'),
					buttons: renderMainMenu().buttons,
				},
				recipient,
			);
		}

		if (action === 'sf') {
			return this.handleStudySelectionCallback(userId, event, recipient, rest);
		}

		if (action === 'spref') {
			return this.handleStudentPreferenceCallback(
				userId,
				event,
				recipient,
				rest,
			);
		}

		if (action === 'pref') {
			return this.handlePreferenceCallback(userId, event, recipient, rest);
		}

		if (action === 'course') {
			return this.handleCourseCallback(userId, event, recipient, rest);
		}

		if (action === 'unsubscribe') {
			if (rest[0] === 'confirm') {
				await this.deps.unsubscribeFromProgram.execute(userId);
				await this.clearState(userId, event);
				return this.toMessage(
					{
						text: 'اشتراک شما لغو شد.',
						buttons: renderMainMenu().buttons,
					},
					recipient,
				);
			}
			await this.clearState(userId, event);
			return this.toMessage(renderMainMenu(), recipient);
		}

		if (action === 'noop') return null;

		return this.toMessage(renderMainMenu(), recipient);
	}

	private async startStudySelectionFlow(
		userId: string,
		event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
	): Promise<OutboundMessage> {
		await this.clearState(userId, event);
		const [terms, levels] = await Promise.all([
			this.deps.getAvailableTerms.execute(),
			this.deps.getAvailableLevels.execute(),
		]);
		if (terms.length === 0) {
			return this.toMessage(
				{
					text: 'هنوز ترمی از منبع دانشگاه وارد نشده است.',
					buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
				},
				recipient,
			);
		}
		if (levels.length === 0) {
			return this.toMessage(renderUnresolvedProgramGrouping(), recipient);
		}
		return this.toMessage(renderStudyLevels(levels), recipient);
	}

	private async handleStudySelectionCallback(
		userId: string,
		event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
		parts: string[],
	): Promise<OutboundMessage> {
		const [operation, ...values] = parts;
		const value = values[0];
		const state = await this.getState(userId, event);

		if (operation === 'level' && value) {
			const fields = await this.deps.getStudyFields.execute(value);
			if (fields.length === 0) {
				return this.toMessage(
					{
						text: 'برای این مقطع رشته‌ای تعریف نشده است.',
						buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
					},
					recipient,
				);
			}
			await this.saveState(userId, event, 'STUDY_SELECT_FIELD', {
				levelId: value,
			});
			return this.toMessage(renderStudyFields(fields), recipient);
		}

		if (operation === 'field' && value) {
			if (!state?.data.levelId) {
				return this.toMessage(this.restartFlowContent(), recipient);
			}
			const terms = await this.deps.getAvailableTerms.execute();
			await this.saveState(userId, event, 'STUDY_SELECT_TERM', {
				levelId: state.data.levelId,
				fieldId: value,
			});
			return this.toMessage(renderStudyTerms(terms), recipient);
		}

		if (operation === 'term' && value) {
			if (!state?.data.levelId || !state.data.fieldId) {
				return this.toMessage(this.restartFlowContent(), recipient);
			}
			const offerings = await this.deps.getAvailableCourseOfferings.execute(
				userId,
				{ studyFieldId: state.data.fieldId, termId: value },
			);
			if (offerings.length === 0) {
				return this.toMessage(
					{
						text: 'برای این رشته و ترم درسی تعریف نشده است.',
						buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
					},
					recipient,
				);
			}
			await this.saveState(userId, event, 'STUDY_SELECT_COURSES', {
				levelId: state.data.levelId,
				fieldId: state.data.fieldId,
				termId: value,
				selectedCourseOfferingIds: '',
			});
			return this.toMessage(
				renderCourseOfferings(offerings, new Set()),
				recipient,
			);
		}

		if (
			(operation === 'toggle' || operation === 'save') &&
			state?.data.levelId &&
			state.data.fieldId &&
			state.data.termId
		) {
			const selected = new Set(
				(state.data.selectedCourseOfferingIds ?? '')
					.split(',')
					.filter(Boolean),
			);
			if (operation === 'toggle' && value) {
				if (selected.has(value)) selected.delete(value);
				else selected.add(value);
				await this.saveState(userId, event, 'STUDY_SELECT_COURSES', {
					levelId: state.data.levelId,
					fieldId: state.data.fieldId,
					termId: state.data.termId,
					selectedCourseOfferingIds: [...selected].join(','),
				});
				const offerings = await this.deps.getAvailableCourseOfferings.execute(
					userId,
					{
						studyFieldId: state.data.fieldId,
						termId: state.data.termId,
					},
				);
				return this.toMessage(
					renderCourseOfferings(offerings, selected),
					recipient,
				);
			}

			if (operation === 'save') {
				await this.deps.saveStudentCourseSelection.execute({
					userId,
					academicLevelId: state.data.levelId,
					studyFieldId: state.data.fieldId,
					academicTermId: state.data.termId,
					selectedCourseOfferingIds: [...selected],
				});
				await this.clearState(userId, event);
				return this.toMessage(
					{
						text: `انتخاب دروس ذخیره شد. ${selected.size} درس فعال است.`,
						buttons: renderMainMenu().buttons,
					},
					recipient,
				);
			}
		}

		return this.toMessage(this.restartFlowContent(), recipient);
	}

	private async handleStudentPreferenceCallback(
		userId: string,
		event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
		parts: string[],
	): Promise<OutboundMessage> {
		const [operation, value] = parts;
		if (operation === 'toggle' && value === 'reminder') {
			const current = await this.deps.uow.run((repositories) =>
				repositories.studentSelections.findActiveByUserId(userId),
			);
			if (!current) {
				return this.toMessage(this.needSubscriptionContent(), recipient);
			}
			const updated =
				await this.deps.updateStudentNotificationPreferences.execute(userId, {
					classReminderEnabled: !current.classReminderEnabled,
				});
			return this.toMessage(renderStudentPreferences(updated), recipient);
		}

		if (operation === 'offset' && value) {
			const updated =
				await this.deps.updateStudentNotificationPreferences.execute(userId, {
					reminderOffsetMinutes: Number(value),
				});
			return this.toMessage(renderStudentPreferences(updated), recipient);
		}

		const selection = await this.deps.uow.run((repositories) =>
			repositories.studentSelections.findActiveByUserId(userId),
		);
		if (!selection) {
			return this.toMessage(this.needSubscriptionContent(), recipient);
		}
		return this.toMessage(renderStudentPreferences(selection), recipient);
	}

	private async handlePreferenceCallback(
		userId: string,
		_event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
		parts: string[],
	): Promise<OutboundMessage> {
		const subscription = await this.deps.getCurrentSubscription.execute(userId);
		if (!subscription?.preferences) {
			return this.toMessage(this.needSubscriptionContent(), recipient);
		}

		const [operation, ...values] = parts;
		const value = values[0];
		let changes: NotificationPreferenceChanges | null = null;

		if (operation === 'toggle' && value === 'summary') {
			changes = {
				dailySummaryEnabled: !subscription.preferences.dailySummaryEnabled,
			};
		} else if (operation === 'toggle' && value === 'reminder') {
			changes = {
				classReminderEnabled: !subscription.preferences.classReminderEnabled,
			};
		} else if (operation === 'toggle' && value === 'empty') {
			changes = {
				notifyOnEmptyDays: !subscription.preferences.notifyOnEmptyDays,
			};
		} else if (operation === 'time' && values.length > 0) {
			changes = { dailySummaryTime: values.join(':') };
		} else if (operation === 'offset' && value) {
			changes = { reminderOffsetMinutes: Number(value) };
		}

		if (!changes) {
			return this.toMessage(renderPreferences(subscription), recipient);
		}

		const updated = await this.deps.updateNotificationPreferences.execute(
			userId,
			changes,
		);
		return this.toMessage(renderPreferences(updated), recipient);
	}

	private async handleCourseCallback(
		userId: string,
		event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
		parts: string[],
	): Promise<OutboundMessage> {
		const [operation, courseOfferingId] = parts;

		if (operation === 'follow') {
			await this.deps.followProgramDefault.execute(userId);
			await this.clearState(userId, event);
			return this.toMessage(
				{
					text: 'برنامه به حالت پیروی از دروس پیش‌فرض بازگشت.',
					buttons: renderMainMenu().buttons,
				},
				recipient,
			);
		}

		const courses = await this.deps.getProgramCourses.execute(userId);
		if (!courses) {
			return this.toMessage(this.needSubscriptionContent(), recipient);
		}

		const state = await this.getState(userId, event);
		const selected = new Set(
			state?.data.selectedCourseOfferingIds
				? state.data.selectedCourseOfferingIds.split(',').filter(Boolean)
				: courses.courses
						.filter((course) => course.selected)
						.map((course) => course.courseOfferingId),
		);

		if (operation === 'toggle' && courseOfferingId) {
			if (selected.has(courseOfferingId)) selected.delete(courseOfferingId);
			else selected.add(courseOfferingId);
			await this.saveState(userId, event, 'CUSTOMIZE', {
				selectedCourseOfferingIds: [...selected].join(','),
			});
			return this.toMessage(renderProgramCourses(courses, selected), recipient);
		}

		if (operation === 'save') {
			const updated = await this.deps.customizeCourseSelection.execute(userId, [
				...selected,
			]);
			await this.clearState(userId, event);
			return this.toMessage(
				{
					text: `انتخاب دروس ذخیره شد. ${updated.selectedCourseOfferingIds.length} درس فعال است.`,
					buttons: renderMainMenu().buttons,
				},
				recipient,
			);
		}

		return this.toMessage(renderProgramCourses(courses, selected), recipient);
	}

	private async startSubscriptionFlow(
		userId: string,
		event: IncomingPlatformEvent,
		recipient: OutboundRecipient,
	): Promise<OutboundMessage> {
		await this.clearState(userId, event);
		const [terms, levels] = await Promise.all([
			this.deps.getAvailableTerms.execute(),
			this.deps.getAvailableLevels.execute(),
		]);

		if (terms.length === 0) {
			return this.toMessage(
				{
					text: 'هنوز داده‌ای از منبع دانشگاه وارد نشده است. لطفاً بعداً تلاش کنید.',
					buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
				},
				recipient,
			);
		}

		if (levels.length === 0) {
			return this.toMessage(renderUnresolvedProgramGrouping(), recipient);
		}

		return this.toMessage(renderLevels(levels), recipient);
	}

	private needSubscriptionContent(): BotContent {
		return {
			text: 'ابتدا یک برنامه تحصیلی انتخاب کنید.',
			buttons: [
				[{ text: 'انتخاب برنامه', callbackData: 'menu:subscribe' }],
				[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
			],
		};
	}

	private restartFlowContent(): BotContent {
		return {
			text: 'مرحله انتخاب منقضی شده است. لطفاً از منو دوباره شروع کنید.',
			buttons: [
				[{ text: 'انتخاب برنامه', callbackData: 'menu:subscribe' }],
				[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
			],
		};
	}

	private toMessage(
		content: BotContent,
		recipient: OutboundRecipient,
	): OutboundMessage {
		return {
			recipient,
			text: content.text,
			buttons: content.buttons,
		};
	}

	private recipientOf(event: IncomingPlatformEvent): OutboundRecipient {
		return {
			platform: event.platform,
			botScope: event.botScope,
			externalUserId: event.externalUserId,
			externalChatId: event.externalChatId,
		};
	}

	private async getState(userId: string, event: IncomingPlatformEvent) {
		return this.deps.stateStore.get({
			userId,
			platform: event.platform,
			botScope: event.botScope,
		});
	}

	private async saveState(
		userId: string,
		event: IncomingPlatformEvent,
		step: string,
		data: Record<string, string>,
	): Promise<void> {
		const now = this.deps.clock.now();
		await this.deps.stateStore.set({
			userId,
			platform: event.platform,
			botScope: event.botScope,
			step,
			data,
			updatedAt: now,
			expiresAt: new Date(now.getTime() + STATE_TTL_MS),
		});
	}

	private async clearState(
		userId: string,
		event: IncomingPlatformEvent,
	): Promise<void> {
		await this.deps.stateStore.clear({
			userId,
			platform: event.platform,
			botScope: event.botScope,
		});
	}
}
