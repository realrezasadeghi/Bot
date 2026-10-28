import { ValidationError } from '../shared/errors.js';
import type { LocalDate } from '../shared/local-date.js';
import type { LocalTime } from '../shared/local-time.js';

export enum ExaminationStatus {
	Scheduled = 'SCHEDULED',
	CANCELLED = 'CANCELLED',
}

export class CourseExamination {
	private constructor(
		readonly id: string,
		readonly courseOfferingId: string,
		readonly examDate: LocalDate,
		readonly startTime: LocalTime | null,
		readonly endTime: LocalTime | null,
		readonly location: string | null,
		readonly sourceIdentifier: string | null,
		readonly status: ExaminationStatus,
	) {}

	static create(input: {
		id: string;
		courseOfferingId: string;
		examDate: LocalDate;
		startTime?: LocalTime | null;
		endTime?: LocalTime | null;
		location?: string | null;
		sourceIdentifier?: string | null;
		status?: ExaminationStatus;
	}): CourseExamination {
		if (!input.id.trim()) {
			throw new ValidationError('CourseExamination.id is required');
		}
		if (!input.courseOfferingId.trim()) {
			throw new ValidationError('CourseExamination.courseOfferingId is required');
		}

		const startTime = input.startTime ?? null;
		const endTime = input.endTime ?? null;
		if (startTime && endTime && !startTime.isBefore(endTime)) {
			throw new ValidationError(
				'CourseExamination.startTime must be before endTime',
			);
		}

		return new CourseExamination(
			input.id.trim(),
			input.courseOfferingId.trim(),
			input.examDate,
			startTime,
			endTime,
			input.location?.trim() || null,
			input.sourceIdentifier?.trim() || null,
			input.status ?? ExaminationStatus.Scheduled,
		);
	}

	isActive(): boolean {
		return this.status === ExaminationStatus.Scheduled;
	}
}
