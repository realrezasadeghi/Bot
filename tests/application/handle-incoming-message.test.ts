import { describe, expect, it, vi } from 'vitest';
import type { IncomingPlatformEvent } from '../../src/application/dto/incoming.js';
import type { SubscriptionDto } from '../../src/application/dto/schedule.js';
import {
	HandleIncomingPlatformMessage,
	type IncomingMessageDependencies,
} from '../../src/application/use-cases/messaging/handle-incoming-platform-message.js';
import type { NotificationPreferenceChanges } from '../../src/application/use-cases/subscriptions/update-notification-preferences.js';
import { PlatformCode } from '../../src/domain/identity/platform-identity.js';

const subscription: SubscriptionDto = {
	id: 'subscription-1',
	programOfferingId: 'program-offering-1',
	programTitle: 'Computer Engineering',
	termTitle: '1405-1',
	mode: 'FOLLOW_PROGRAM',
	status: 'ACTIVE',
	selectedCourseOfferingIds: [],
	preferences: {
		dailySummaryEnabled: true,
		dailySummaryTime: '08:00',
		classReminderEnabled: true,
		reminderOffsetMinutes: 60,
		notifyOnEmptyDays: false,
	},
};

function event(callbackData: string): IncomingPlatformEvent {
	return {
		platform: PlatformCode.Telegram,
		botScope: 'telegram-main',
		externalUserId: '123',
		externalChatId: '456',
		externalMessageId: '10',
		username: 'reza',
		displayName: 'Reza',
		localeHint: 'fa',
		kind: 'CALLBACK',
		text: null,
		callbackData,
		receivedAt: new Date('2026-01-01T00:00:00.000Z'),
	};
}

describe('HandleIncomingPlatformMessage preference callbacks', () => {
	it('preserves the minutes part of a daily summary time callback', async () => {
		let captured: NotificationPreferenceChanges | null = null;
		const updated: SubscriptionDto = {
			...subscription,
			preferences: {
				dailySummaryEnabled: subscription.preferences?.dailySummaryEnabled ?? true,
				dailySummaryTime: '07:30',
				classReminderEnabled:
					subscription.preferences?.classReminderEnabled ?? true,
				reminderOffsetMinutes:
					subscription.preferences?.reminderOffsetMinutes ?? 60,
				notifyOnEmptyDays: subscription.preferences?.notifyOnEmptyDays ?? false,
			},
		};

		const dependencies = {
			registerOrResolveUser: {
				execute: vi.fn(async () => ({ user: { id: 'user-1' } })),
			},
			getCurrentSubscription: {
				execute: vi.fn(async () => subscription),
			},
			updateNotificationPreferences: {
				execute: vi.fn(
					async (_userId: string, changes: NotificationPreferenceChanges) => {
						captured = changes;
						return updated;
					},
				),
			},
		} as unknown as IncomingMessageDependencies;

		const handler = new HandleIncomingPlatformMessage(dependencies);
		const result = await handler.execute(event('pref:time:07:30'));

		expect(captured).toEqual({ dailySummaryTime: '07:30' });
		expect(result?.text).toContain('07:30');
	});

	it('toggles the reminder setting', async () => {
		let captured: NotificationPreferenceChanges | null = null;
		const dependencies = {
			registerOrResolveUser: {
				execute: vi.fn(async () => ({ user: { id: 'user-1' } })),
			},
			getCurrentSubscription: {
				execute: vi.fn(async () => subscription),
			},
			updateNotificationPreferences: {
				execute: vi.fn(
					async (_userId: string, changes: NotificationPreferenceChanges) => {
						captured = changes;
						return subscription;
					},
				),
			},
		} as unknown as IncomingMessageDependencies;

		const handler = new HandleIncomingPlatformMessage(dependencies);
		await handler.execute(event('pref:toggle:reminder'));

		expect(captured).toEqual({ classReminderEnabled: false });
	});
});
