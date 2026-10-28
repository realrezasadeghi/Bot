import type { UserAcademicSelection } from '../../../domain/academic/study-field.js';
import { NotFoundError } from '../../../domain/shared/errors.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface StudentNotificationPreferenceChanges {
	classReminderEnabled?: boolean;
	reminderOffsetMinutes?: number;
}

export class UpdateStudentNotificationPreferences {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
		},
	) {}

	async execute(
		userId: string,
		changes: StudentNotificationPreferenceChanges,
	): Promise<UserAcademicSelection> {
		const now = this.deps.clock.now();
		return this.deps.uow.run(async (repositories) => {
			const selection =
				await repositories.studentSelections.findActiveByUserId(userId);
			if (!selection) {
				throw new NotFoundError(`No active academic selection for user ${userId}`);
			}

			const updated = selection.withNotificationPreferences({
				classReminderEnabled: changes.classReminderEnabled,
				reminderOffsetMinutes: changes.reminderOffsetMinutes,
				updatedAt: now,
			});
			await repositories.studentSelections.update(updated);
			await repositories.jobs.cancelPendingBySelection(
				updated.id,
				now,
				'STUDENT_NOTIFICATION_PREFERENCES_CHANGED',
			);
			return updated;
		});
	}
}
