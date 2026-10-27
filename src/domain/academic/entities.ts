import { ValidationError } from '../shared/errors.js';
import type { LocalDate } from '../shared/local-date.js';
import type { LocalTime } from '../shared/local-time.js';
import type { Weekday } from '../shared/weekday.js';
import { isWeekday } from '../shared/weekday.js';

function requireNonEmpty(value: string, field: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw new ValidationError(`${field} must not be empty`);
	}
	return trimmed;
}

function optionalNonEmpty(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export class AcademicLevel {
	private constructor(
		readonly id: string,
		readonly code: string,
		readonly title: string,
	) {}

	static create(input: {
		id: string;
		code: string;
		title: string;
	}): AcademicLevel {
		return new AcademicLevel(
			requireNonEmpty(input.id, 'AcademicLevel.id'),
			requireNonEmpty(input.code, 'AcademicLevel.code'),
			requireNonEmpty(input.title, 'AcademicLevel.title'),
		);
	}
}

export class FieldOfStudy {
	private constructor(
		readonly id: string,
		readonly levelId: string,
		readonly code: string,
		readonly title: string,
	) {}

	static create(input: {
		id: string;
		levelId: string;
		code: string;
		title: string;
	}): FieldOfStudy {
		return new FieldOfStudy(
			requireNonEmpty(input.id, 'FieldOfStudy.id'),
			requireNonEmpty(input.levelId, 'FieldOfStudy.levelId'),
			requireNonEmpty(input.code, 'FieldOfStudy.code'),
			requireNonEmpty(input.title, 'FieldOfStudy.title'),
		);
	}
}

export class AcademicTerm {
	private constructor(
		readonly id: string,
		readonly externalCode: string,
		readonly title: string,
		readonly startsOn: LocalDate | null,
		readonly endsOn: LocalDate | null,
		readonly isActive: boolean,
	) {}

	static create(input: {
		id: string;
		externalCode: string;
		title: string;
		startsOn?: LocalDate | null;
		endsOn?: LocalDate | null;
		isActive: boolean;
	}): AcademicTerm {
		const startsOn = input.startsOn ?? null;
		const endsOn = input.endsOn ?? null;
		if (startsOn && endsOn && startsOn.isAfter(endsOn)) {
			throw new ValidationError('AcademicTerm.startsOn must not be after endsOn');
		}

		return new AcademicTerm(
			requireNonEmpty(input.id, 'AcademicTerm.id'),
			requireNonEmpty(input.externalCode, 'AcademicTerm.externalCode'),
			requireNonEmpty(input.title, 'AcademicTerm.title'),
			startsOn,
			endsOn,
			input.isActive,
		);
	}

	covers(date: LocalDate): boolean {
		if (this.startsOn && date.isBefore(this.startsOn)) return false;
		if (this.endsOn && date.isAfter(this.endsOn)) return false;
		return true;
	}
}

export class AcademicProgram {
	private constructor(
		readonly id: string,
		readonly levelId: string,
		readonly fieldOfStudyId: string,
		readonly code: string,
		readonly title: string,
	) {}

	static create(input: {
		id: string;
		levelId: string;
		fieldOfStudyId: string;
		code: string;
		title: string;
	}): AcademicProgram {
		return new AcademicProgram(
			requireNonEmpty(input.id, 'AcademicProgram.id'),
			requireNonEmpty(input.levelId, 'AcademicProgram.levelId'),
			requireNonEmpty(input.fieldOfStudyId, 'AcademicProgram.fieldOfStudyId'),
			requireNonEmpty(input.code, 'AcademicProgram.code'),
			requireNonEmpty(input.title, 'AcademicProgram.title'),
		);
	}
}

export class ProgramOffering {
	private constructor(
		readonly id: string,
		readonly programId: string,
		readonly termId: string,
		readonly externalKey: string,
		readonly title: string,
	) {}

	static create(input: {
		id: string;
		programId: string;
		termId: string;
		externalKey: string;
		title: string;
	}): ProgramOffering {
		return new ProgramOffering(
			requireNonEmpty(input.id, 'ProgramOffering.id'),
			requireNonEmpty(input.programId, 'ProgramOffering.programId'),
			requireNonEmpty(input.termId, 'ProgramOffering.termId'),
			requireNonEmpty(input.externalKey, 'ProgramOffering.externalKey'),
			requireNonEmpty(input.title, 'ProgramOffering.title'),
		);
	}
}

export class Course {
	private constructor(
		readonly id: string,
		readonly code: string,
		readonly title: string,
		readonly units: number | null,
	) {}

	static create(input: {
		id: string;
		code: string;
		title: string;
		units?: number | null;
	}): Course {
		const units = input.units ?? null;
		if (units !== null && (!Number.isFinite(units) || units < 0 || units > 30)) {
			throw new ValidationError('Course.units must be between 0 and 30');
		}
		return new Course(
			requireNonEmpty(input.id, 'Course.id'),
			requireNonEmpty(input.code, 'Course.code'),
			requireNonEmpty(input.title, 'Course.title'),
			units,
		);
	}
}

export class Instructor {
	private constructor(
		readonly id: string,
		readonly externalKey: string,
		readonly fullName: string,
	) {}

	static create(input: {
		id: string;
		externalKey: string;
		fullName: string;
	}): Instructor {
		return new Instructor(
			requireNonEmpty(input.id, 'Instructor.id'),
			requireNonEmpty(input.externalKey, 'Instructor.externalKey'),
			requireNonEmpty(input.fullName, 'Instructor.fullName'),
		);
	}
}

export class CourseOffering {
	private constructor(
		readonly id: string,
		readonly courseId: string,
		readonly termId: string,
		readonly programOfferingId: string | null,
		readonly sectionCode: string | null,
		readonly instructorIds: ReadonlyArray<string>,
		readonly location: string | null,
		readonly externalKey: string,
		readonly isActive: boolean,
	) {}

	static create(input: {
		id: string;
		courseId: string;
		termId: string;
		programOfferingId?: string | null;
		sectionCode?: string | null;
		instructorIds?: ReadonlyArray<string>;
		location?: string | null;
		externalKey: string;
		isActive?: boolean;
	}): CourseOffering {
		const instructorIds = [
			...new Set(
				(input.instructorIds ?? []).map((value) => value.trim()).filter(Boolean),
			),
		];

		return new CourseOffering(
			requireNonEmpty(input.id, 'CourseOffering.id'),
			requireNonEmpty(input.courseId, 'CourseOffering.courseId'),
			requireNonEmpty(input.termId, 'CourseOffering.termId'),
			optionalNonEmpty(input.programOfferingId),
			optionalNonEmpty(input.sectionCode),
			instructorIds,
			optionalNonEmpty(input.location),
			requireNonEmpty(input.externalKey, 'CourseOffering.externalKey'),
			input.isActive ?? true,
		);
	}
}

export class MeetingPattern {
	private constructor(
		readonly id: string,
		readonly courseOfferingId: string,
		readonly weekday: Weekday,
		readonly startTime: LocalTime,
		readonly endTime: LocalTime,
		readonly location: string | null,
		readonly effectiveFrom: LocalDate | null,
		readonly effectiveTo: LocalDate | null,
		readonly isActive: boolean,
	) {}

	static create(input: {
		id: string;
		courseOfferingId: string;
		weekday: Weekday;
		startTime: LocalTime;
		endTime: LocalTime;
		location?: string | null;
		effectiveFrom?: LocalDate | null;
		effectiveTo?: LocalDate | null;
		isActive?: boolean;
	}): MeetingPattern {
		if (!isWeekday(input.weekday)) {
			throw new ValidationError('MeetingPattern.weekday must be between 0 and 6');
		}
		if (!input.startTime.isBefore(input.endTime)) {
			throw new ValidationError(
				'MeetingPattern start time must be before end time',
			);
		}

		const effectiveFrom = input.effectiveFrom ?? null;
		const effectiveTo = input.effectiveTo ?? null;
		if (effectiveFrom && effectiveTo && effectiveFrom.isAfter(effectiveTo)) {
			throw new ValidationError(
				'MeetingPattern.effectiveFrom must not be after effectiveTo',
			);
		}

		return new MeetingPattern(
			requireNonEmpty(input.id, 'MeetingPattern.id'),
			requireNonEmpty(input.courseOfferingId, 'MeetingPattern.courseOfferingId'),
			input.weekday,
			input.startTime,
			input.endTime,
			optionalNonEmpty(input.location),
			effectiveFrom,
			effectiveTo,
			input.isActive ?? true,
		);
	}

	appliesOn(date: LocalDate): boolean {
		if (!this.isActive) return false;
		if (date.weekday() !== this.weekday) return false;
		if (this.effectiveFrom && date.isBefore(this.effectiveFrom)) return false;
		if (this.effectiveTo && date.isAfter(this.effectiveTo)) return false;
		return true;
	}
}
