import { ValidationError } from '../shared/errors.js';
import type { LocalDate } from '../shared/local-date.js';
import type { LocalTime } from '../shared/local-time.js';

export enum ScheduleExceptionType {
	Cancelled = 'CANCELLED',
	Rescheduled = 'RESCHEDULED',
	TimeChanged = 'TIME_CHANGED',
	LocationChanged = 'LOCATION_CHANGED',
}

export interface ScheduleExceptionInput {
	id: string;
	courseOfferingId: string;
	meetingPatternId?: string | null;
	date: LocalDate;
	type: ScheduleExceptionType;
	newStartTime?: LocalTime | null;
	newEndTime?: LocalTime | null;
	newLocation?: string | null;
	reason?: string | null;
}

export class ScheduleException {
	private constructor(
		readonly id: string,
		readonly courseOfferingId: string,
		readonly meetingPatternId: string | null,
		readonly date: LocalDate,
		readonly type: ScheduleExceptionType,
		readonly newStartTime: LocalTime | null,
		readonly newEndTime: LocalTime | null,
		readonly newLocation: string | null,
		readonly reason: string | null,
	) {}

	static create(input: ScheduleExceptionInput): ScheduleException {
		if (!input.id.trim())
			throw new ValidationError('ScheduleException.id is required');
		if (!input.courseOfferingId.trim()) {
			throw new ValidationError('ScheduleException.courseOfferingId is required');
		}

		const newStartTime = input.newStartTime ?? null;
		const newEndTime = input.newEndTime ?? null;
		const newLocation = input.newLocation?.trim() || null;

		const requiresTimes =
			input.type === ScheduleExceptionType.Rescheduled ||
			input.type === ScheduleExceptionType.TimeChanged;

		if (requiresTimes) {
			if (!newStartTime || !newEndTime) {
				throw new ValidationError(
					`${input.type} schedule exceptions require new start and end times`,
				);
			}
			if (!newStartTime.isBefore(newEndTime)) {
				throw new ValidationError(
					'ScheduleException start time must be before end time',
				);
			}
		}

		if (input.type === ScheduleExceptionType.LocationChanged && !newLocation) {
			throw new ValidationError(
				'LOCATION_CHANGED schedule exceptions require a new location',
			);
		}

		return new ScheduleException(
			input.id.trim(),
			input.courseOfferingId.trim(),
			input.meetingPatternId?.trim() || null,
			input.date,
			input.type,
			newStartTime,
			newEndTime,
			newLocation,
			input.reason?.trim() || null,
		);
	}

	appliesTo(
		courseOfferingId: string,
		meetingPatternId: string,
		date: LocalDate,
	): boolean {
		if (this.courseOfferingId !== courseOfferingId) return false;
		if (!this.date.equals(date)) return false;
		return (
			this.meetingPatternId === null || this.meetingPatternId === meetingPatternId
		);
	}
}
