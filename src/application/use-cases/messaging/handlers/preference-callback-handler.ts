import type { OutboundMessage } from '../../../../application/dto/messaging.js';
import type { NotificationPreferenceChanges } from '../../subscriptions/update-notification-preferences.js';
import type {
	CallbackContext,
	CallbackHandler,
	HandlerDeps,
} from './handler-deps.js';

export type { CallbackContext, CallbackHandler };

export class StudentPreferenceCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const { userId, recipient, payload } = context;
		const [operation, value] = payload.params;
		if (operation === 'toggle' && value === 'reminder') {
			const current = await this.deps.uow.run((repositories) =>
				repositories.studentSelections.findActiveByUserId(userId),
			);
			if (!current) {
				return this.deps.renderer.needSubscription(recipient);
			}
			const updated = await this.deps.updateStudentNotificationPreferences.execute(
				userId,
				{
					classReminderEnabled: !current.classReminderEnabled,
				},
			);
			return this.deps.renderer.studentPreferences(updated, recipient);
		}

		if (operation === 'offset' && value) {
			const updated = await this.deps.updateStudentNotificationPreferences.execute(
				userId,
				{
					reminderOffsetMinutes: Number(value),
				},
			);
			return this.deps.renderer.studentPreferences(updated, recipient);
		}

		const selection = await this.deps.uow.run((repositories) =>
			repositories.studentSelections.findActiveByUserId(userId),
		);
		if (!selection) {
			return this.deps.renderer.needSubscription(recipient);
		}
		return this.deps.renderer.studentPreferences(selection, recipient);
	}
}

export class PreferenceCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const { userId, recipient, payload } = context;
		const subscription = await this.deps.getCurrentSubscription.execute(userId);
		if (!subscription?.preferences) {
			return this.deps.renderer.needSubscription(recipient);
		}

		const [operation, ...values] = payload.params;
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
			return this.deps.renderer.preferences(subscription, recipient);
		}

		const updated = await this.deps.updateNotificationPreferences.execute(
			userId,
			changes,
		);
		return this.deps.renderer.preferences(updated, recipient);
	}
}

export class CourseCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const { userId, event, recipient, payload } = context;
		const [operation, courseOfferingId] = payload.params;

		if (operation === 'follow') {
			await this.deps.followProgramDefault.execute(userId);
			await this.deps.stateStore.clear({
				userId,
				platform: event.platform,
				botScope: event.botScope,
			});
			return {
				recipient,
				text: 'برنامه به حالت پیروی از دروس پیش‌فرض بازگشت.',
				buttons: this.deps.renderer.mainMenu(recipient).buttons,
			};
		}

		const courses = await this.deps.getProgramCourses.execute(userId);
		if (!courses) {
			return this.deps.renderer.needSubscription(recipient);
		}

		const state = await this.deps.stateStore.get({
			userId,
			platform: event.platform,
			botScope: event.botScope,
		});
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
			await this.deps.stateStore.set({
				userId,
				platform: event.platform,
				botScope: event.botScope,
				step: 'CUSTOMIZE',
				data: { selectedCourseOfferingIds: [...selected].join(',') },
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
			});
			return this.deps.renderer.programCourses(courses, selected, recipient);
		}

		if (operation === 'save') {
			const updated = await this.deps.customizeCourseSelection.execute(userId, [
				...selected,
			]);
			await this.deps.stateStore.clear({
				userId,
				platform: event.platform,
				botScope: event.botScope,
			});
			return {
				recipient,
				text: `انتخاب دروس ذخیره شد. ${updated.selectedCourseOfferingIds.length} درس فعال است.`,
				buttons: this.deps.renderer.mainMenu(recipient).buttons,
			};
		}

		return this.deps.renderer.programCourses(courses, selected, recipient);
	}
}

export class UnsubscribeCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const { userId, event, recipient, payload } = context;
		if (payload.params[0] === 'confirm') {
			await this.deps.unsubscribeFromProgram.execute(userId);
			await this.deps.stateStore.clear({
				userId,
				platform: event.platform,
				botScope: event.botScope,
			});
			return {
				recipient,
				text: 'اشتراک شما لغو شد.',
				buttons: this.deps.renderer.mainMenu(recipient).buttons,
			};
		}
		await this.deps.stateStore.clear({
			userId,
			platform: event.platform,
			botScope: event.botScope,
		});
		return this.deps.renderer.mainMenu(recipient);
	}
}
