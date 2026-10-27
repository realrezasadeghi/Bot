import { ValidationError } from '../shared/errors.js';
import { LocalTime } from '../shared/local-time.js';

export class NotificationPreference {
	static readonly MAX_REMINDER_OFFSET_MINUTES = 720;

	private constructor(
		readonly id: string,
		readonly subscriptionId: string,
		readonly dailySummaryEnabled: boolean,
		readonly dailySummaryTime: LocalTime,
		readonly classReminderEnabled: boolean,
		readonly reminderOffsetMinutes: number,
		readonly notifyOnEmptyDays: boolean,
		readonly updatedAt: Date,
	) {}

	static create(input: {
		id: string;
		subscriptionId: string;
		dailySummaryEnabled?: boolean;
		dailySummaryTime?: LocalTime;
		classReminderEnabled?: boolean;
		reminderOffsetMinutes?: number;
		notifyOnEmptyDays?: boolean;
		updatedAt?: Date;
	}): NotificationPreference {
		if (!input.id.trim()) {
			throw new ValidationError('NotificationPreference.id is required');
		}
		if (!input.subscriptionId.trim()) {
			throw new ValidationError(
				'NotificationPreference.subscriptionId is required',
			);
		}

		const reminderOffsetMinutes = input.reminderOffsetMinutes ?? 60;
		if (
			!Number.isInteger(reminderOffsetMinutes) ||
			reminderOffsetMinutes < 0 ||
			reminderOffsetMinutes > NotificationPreference.MAX_REMINDER_OFFSET_MINUTES
		) {
			throw new ValidationError(
				`reminderOffsetMinutes must be an integer between 0 and ${NotificationPreference.MAX_REMINDER_OFFSET_MINUTES}`,
			);
		}

		return new NotificationPreference(
			input.id.trim(),
			input.subscriptionId.trim(),
			input.dailySummaryEnabled ?? true,
			input.dailySummaryTime ?? LocalTime.parse('08:00'),
			input.classReminderEnabled ?? true,
			reminderOffsetMinutes,
			input.notifyOnEmptyDays ?? false,
			input.updatedAt ?? new Date(),
		);
	}

	withChanges(input: {
		dailySummaryEnabled?: boolean;
		dailySummaryTime?: LocalTime;
		classReminderEnabled?: boolean;
		reminderOffsetMinutes?: number;
		notifyOnEmptyDays?: boolean;
		updatedAt?: Date;
	}): NotificationPreference {
		return NotificationPreference.create({
			id: this.id,
			subscriptionId: this.subscriptionId,
			dailySummaryEnabled: input.dailySummaryEnabled ?? this.dailySummaryEnabled,
			dailySummaryTime: input.dailySummaryTime ?? this.dailySummaryTime,
			classReminderEnabled:
				input.classReminderEnabled ?? this.classReminderEnabled,
			reminderOffsetMinutes:
				input.reminderOffsetMinutes ?? this.reminderOffsetMinutes,
			notifyOnEmptyDays: input.notifyOnEmptyDays ?? this.notifyOnEmptyDays,
			updatedAt: input.updatedAt ?? new Date(),
		});
	}
}
