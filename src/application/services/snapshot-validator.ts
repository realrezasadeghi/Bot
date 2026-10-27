import {
	ScheduleException,
	type ScheduleExceptionType,
} from '../../domain/academic/schedule-exception.js';
import { ValidationError } from '../../domain/shared/errors.js';
import { LocalDate } from '../../domain/shared/local-date.js';
import { LocalTime } from '../../domain/shared/local-time.js';
import { isWeekday } from '../../domain/shared/weekday.js';
import {
	type UniversityAcademicSnapshot,
	UniversitySnapshotValidationError,
} from '../dto/university.js';

function findDuplicates(values: ReadonlyArray<string>): string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) duplicates.add(value);
		seen.add(value);
	}
	return [...duplicates];
}

function requireUnique(
	label: string,
	values: ReadonlyArray<string>,
	issues: string[],
): void {
	for (const duplicate of findDuplicates(values)) {
		issues.push(`Duplicate ${label} external key: ${duplicate}`);
	}
}

function checkLocalDate(
	value: string | null,
	label: string,
	issues: string[],
): LocalDate | null {
	if (value === null) return null;
	try {
		return LocalDate.parse(value);
	} catch {
		issues.push(`${label} has an invalid date: ${value}`);
		return null;
	}
}

function checkLocalTime(
	value: string | null,
	label: string,
	issues: string[],
): LocalTime | null {
	if (value === null) return null;
	try {
		return LocalTime.parse(value);
	} catch {
		issues.push(`${label} has an invalid time: ${value}`);
		return null;
	}
}

export function validateUniversitySnapshot(
	snapshot: UniversityAcademicSnapshot,
): void {
	const issues: string[] = [];

	if (!snapshot.term.externalCode.trim()) {
		issues.push('Snapshot term external code is empty');
	}

	const levelKeys = snapshot.levels.map((level) => level.externalKey);
	const fieldKeys = snapshot.fields.map((field) => field.externalKey);
	const programKeys = snapshot.programs.map((program) => program.externalKey);
	const programOfferingKeys = snapshot.programOfferings.map(
		(offering) => offering.externalKey,
	);
	const courseKeys = snapshot.courses.map((course) => course.externalKey);
	const instructorKeys = snapshot.instructors.map(
		(instructor) => instructor.externalKey,
	);
	const courseOfferingKeys = snapshot.courseOfferings.map(
		(offering) => offering.externalKey,
	);

	requireUnique('academic level', levelKeys, issues);
	requireUnique('field of study', fieldKeys, issues);
	requireUnique('academic program', programKeys, issues);
	requireUnique('program offering', programOfferingKeys, issues);
	requireUnique('course', courseKeys, issues);
	requireUnique('instructor', instructorKeys, issues);
	requireUnique('course offering', courseOfferingKeys, issues);

	const levelKeySet = new Set(levelKeys);
	const fieldKeySet = new Set(fieldKeys);
	const programKeySet = new Set(programKeys);
	const programOfferingKeySet = new Set(programOfferingKeys);
	const courseKeySet = new Set(courseKeys);
	const instructorKeySet = new Set(instructorKeys);

	for (const field of snapshot.fields) {
		if (!levelKeySet.has(field.levelExternalKey)) {
			issues.push(
				`Field ${field.externalKey} references unknown level ${field.levelExternalKey}`,
			);
		}
	}

	for (const program of snapshot.programs) {
		if (!levelKeySet.has(program.levelExternalKey)) {
			issues.push(
				`Program ${program.externalKey} references unknown level ${program.levelExternalKey}`,
			);
		}
		if (!fieldKeySet.has(program.fieldExternalKey)) {
			issues.push(
				`Program ${program.externalKey} references unknown field ${program.fieldExternalKey}`,
			);
		}
	}

	for (const offering of snapshot.programOfferings) {
		if (!programKeySet.has(offering.programExternalKey)) {
			issues.push(
				`Program offering ${offering.externalKey} references unknown program ${offering.programExternalKey}`,
			);
		}
		if (offering.termExternalCode !== snapshot.term.externalCode) {
			issues.push(
				`Program offering ${offering.externalKey} belongs to term ${offering.termExternalCode}, expected ${snapshot.term.externalCode}`,
			);
		}
	}

	const meetingPatternKeys = new Set<string>();

	for (const offering of snapshot.courseOfferings) {
		if (!courseKeySet.has(offering.courseExternalKey)) {
			issues.push(
				`Course offering ${offering.externalKey} references unknown course ${offering.courseExternalKey}`,
			);
		}
		if (offering.termExternalCode !== snapshot.term.externalCode) {
			issues.push(
				`Course offering ${offering.externalKey} belongs to term ${offering.termExternalCode}, expected ${snapshot.term.externalCode}`,
			);
		}
		if (
			offering.programOfferingExternalKey &&
			!programOfferingKeySet.has(offering.programOfferingExternalKey)
		) {
			issues.push(
				`Course offering ${offering.externalKey} references unknown program offering ${offering.programOfferingExternalKey}`,
			);
		}
		for (const instructorKey of offering.instructorExternalKeys) {
			if (!instructorKeySet.has(instructorKey)) {
				issues.push(
					`Course offering ${offering.externalKey} references unknown instructor ${instructorKey}`,
				);
			}
		}

		for (const pattern of offering.meetingPatterns) {
			if (!isWeekday(pattern.weekday)) {
				issues.push(
					`Course offering ${offering.externalKey} has invalid weekday ${pattern.weekday}`,
				);
			}
			const start = checkLocalTime(
				pattern.startTime,
				`Course offering ${offering.externalKey} meeting start`,
				issues,
			);
			const end = checkLocalTime(
				pattern.endTime,
				`Course offering ${offering.externalKey} meeting end`,
				issues,
			);
			if (start && end && !start.isBefore(end)) {
				issues.push(
					`Course offering ${offering.externalKey} has a meeting whose start is not before its end`,
				);
			}
			const effectiveFrom = checkLocalDate(
				pattern.effectiveFrom,
				`Course offering ${offering.externalKey} meeting effectiveFrom`,
				issues,
			);
			const effectiveTo = checkLocalDate(
				pattern.effectiveTo,
				`Course offering ${offering.externalKey} meeting effectiveTo`,
				issues,
			);
			if (effectiveFrom && effectiveTo && effectiveFrom.isAfter(effectiveTo)) {
				issues.push(
					`Course offering ${offering.externalKey} has a meeting range that ends before it starts`,
				);
			}

			const key = [
				offering.externalKey,
				pattern.weekday,
				pattern.startTime,
				pattern.endTime,
				pattern.effectiveFrom ?? '',
				pattern.effectiveTo ?? '',
			].join('|');
			if (meetingPatternKeys.has(key)) {
				issues.push(
					`Duplicate meeting pattern for course offering ${offering.externalKey}: ${pattern.weekday} ${pattern.startTime}-${pattern.endTime}`,
				);
			}
			meetingPatternKeys.add(key);
		}
	}

	const courseOfferingKeySet = new Set(courseOfferingKeys);
	for (const exception of snapshot.scheduleExceptions) {
		if (!courseOfferingKeySet.has(exception.courseOfferingExternalKey)) {
			issues.push(
				`Schedule exception references unknown course offering ${exception.courseOfferingExternalKey}`,
			);
			continue;
		}
		checkLocalDate(
			exception.date,
			`Schedule exception for ${exception.courseOfferingExternalKey}`,
			issues,
		);
		const offering = snapshot.courseOfferings.find(
			(candidate) => candidate.externalKey === exception.courseOfferingExternalKey,
		);
		if (
			exception.meetingPatternIndex !== null &&
			offering &&
			(exception.meetingPatternIndex < 0 ||
				exception.meetingPatternIndex >= offering.meetingPatterns.length)
		) {
			issues.push(
				`Schedule exception for ${exception.courseOfferingExternalKey} references invalid meeting pattern index ${exception.meetingPatternIndex}`,
			);
		}

		try {
			ScheduleException.create({
				id: exception.externalKey ?? 'validation',
				courseOfferingId: exception.courseOfferingExternalKey,
				meetingPatternId:
					exception.meetingPatternIndex === null
						? null
						: `pattern-${exception.meetingPatternIndex}`,
				date: LocalDate.parse(exception.date),
				type: exception.type as ScheduleExceptionType,
				newStartTime: exception.newStartTime
					? LocalTime.parse(exception.newStartTime)
					: null,
				newEndTime: exception.newEndTime
					? LocalTime.parse(exception.newEndTime)
					: null,
				newLocation: exception.newLocation,
				reason: exception.reason,
			});
		} catch (error) {
			issues.push(
				`Schedule exception for ${exception.courseOfferingExternalKey} is invalid: ${
					error instanceof ValidationError ? error.message : 'unknown error'
				}`,
			);
		}
	}

	if (issues.length > 0) {
		throw new UniversitySnapshotValidationError(
			`University snapshot validation failed with ${issues.length} issue(s)`,
			issues,
		);
	}
}
