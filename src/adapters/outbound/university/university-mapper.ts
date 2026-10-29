import type {
	UniversityAcademicSnapshot,
	UniversityCourseDto,
	UniversityCourseOfferingDto,
	UniversityExaminationDto,
	UniversityFieldDto,
	UniversityInstructorDto,
	UniversityLevelDto,
	UniversityProgramDto,
	UniversityProgramOfferingDto,
	UniversityTermDto,
} from '../../../application/dto/university.js';
import type { ParsedRow } from './university-parser.js';
import { slugify } from './university-parser.js';

export function buildSnapshot(
	rows: ReadonlyArray<ParsedRow>,
	request: { sourceKey: string; termCode: string },
	sourceKey: string,
	termCode: string,
	warnings: string[],
): UniversityAcademicSnapshot {
	// --- Derive unique entities ------------------------------------------
	const levelSet = new Set<string>();
	for (const row of rows) {
		if (row.level) levelSet.add(row.level);
	}
	const levels = Array.from(levelSet);
	const levelEntities: UniversityLevelDto[] = levels.map((levelTitle) => ({
		externalKey: `level-${slugify(levelTitle)}`,
		code: slugify(levelTitle),
		title: levelTitle,
	}));
	const levelByTitle = new Map(levelEntities.map((l) => [l.title, l]));

	const termSet = new Set<string>();
	for (const row of rows) {
		if (row.termCode) termSet.add(row.termCode);
	}
	const terms = Array.from(termSet);
	const resolvedTermCode = request.termCode || terms[0] || termCode;
	const term: UniversityTermDto = {
		externalCode: resolvedTermCode,
		title: `Term ${resolvedTermCode}`,
		startsOn: null,
		endsOn: null,
		isActive: true,
	};

	const fieldEntities: UniversityFieldDto[] = [];
	const programEntities: UniversityProgramDto[] = [];
	for (const level of levelEntities) {
		const fieldKey = `field-${level.externalKey}`;
		fieldEntities.push({
			externalKey: fieldKey,
			levelExternalKey: level.externalKey,
			code: level.code,
			title: level.title,
		});
		programEntities.push({
			externalKey: `program-${level.externalKey}`,
			levelExternalKey: level.externalKey,
			fieldExternalKey: fieldKey,
			code: level.code,
			title: level.title,
		});
	}
	const programByLevel = new Map(
		programEntities.map((p) => [p.levelExternalKey, p]),
	);

	const programOfferingEntities: UniversityProgramOfferingDto[] = terms.flatMap(
		(termCode) => {
			const offering: UniversityProgramOfferingDto[] = [];
			for (const program of programEntities) {
				offering.push({
					externalKey: `po-${program.externalKey}-${termCode}`,
					programExternalKey: program.externalKey,
					termExternalCode: termCode,
					title: `${program.title} ${termCode}`,
				});
			}
			return offering;
		},
	);
	const poByProgramAndTerm = new Map(
		programOfferingEntities.map((po) => [
			`${po.programExternalKey}|${po.termExternalCode}`,
			po,
		]),
	);

	const courseEntities: UniversityCourseDto[] = [];
	const courseByName = new Map<string, UniversityCourseDto>();
	for (const row of rows) {
		if (courseByName.has(row.courseName)) continue;
		const externalKey = `course-${slugify(row.courseName)}`;
		const course: UniversityCourseDto = {
			externalKey,
			code: externalKey,
			title: row.courseName,
			units: null,
		};
		courseEntities.push(course);
		courseByName.set(row.courseName, course);
	}

	const instructorEntities: UniversityInstructorDto[] = [];
	const instructorByName = new Map<string, UniversityInstructorDto>();
	for (const row of rows) {
		for (const name of row.instructors) {
			if (instructorByName.has(name)) continue;
			const externalKey = `instructor-${slugify(name)}`;
			const instructor: UniversityInstructorDto = {
				externalKey,
				fullName: name,
			};
			instructorEntities.push(instructor);
			instructorByName.set(name, instructor);
		}
	}

	const courseOfferings: UniversityCourseOfferingDto[] = [];
	const examinations: UniversityExaminationDto[] = [];

	for (const row of rows) {
		const course = courseByName.get(row.courseName);
		if (!course) {
			warnings.push(`Course not found: ${row.courseName}`);
			continue;
		}

		const level = row.level ? levelByTitle.get(row.level) : undefined;
		const program = level ? programByLevel.get(level.externalKey) : undefined;
		const programOffering = program
			? poByProgramAndTerm.get(
					`${program.externalKey}|${row.termCode ?? resolvedTermCode}`,
				)
			: undefined;

		const instructorExternalKeys = row.instructors
			.map((name) => instructorByName.get(name)?.externalKey ?? '')
			.filter(Boolean);

		const sectionCode = row.remainingCapacity ?? null;

		const offering: UniversityCourseOfferingDto = {
			externalKey: `co-${course.externalKey}-${row.termCode ?? resolvedTermCode}-${slugify(row.courseName)}-${courseOfferings.length + 1}`,
			courseExternalKey: course.externalKey,
			termExternalCode: row.termCode ?? resolvedTermCode,
			programOfferingExternalKey: programOffering?.externalKey ?? null,
			sectionCode,
			instructorExternalKeys,
			location: null,
			meetingPatterns: row.schedulePatterns.map((pattern) => ({
				weekday: pattern.weekday,
				startTime: pattern.startTime,
				endTime: pattern.endTime,
				location: pattern.location,
				effectiveFrom: pattern.effectiveFrom,
				effectiveTo: pattern.effectiveTo,
			})),
		};
		courseOfferings.push(offering);

		if (row.exam.date) {
			const sourceIdentifier = `exam-${offering.externalKey}`;
			examinations.push({
				externalKey: sourceIdentifier,
				courseOfferingExternalKey: offering.externalKey,
				examDate: row.exam.date,
				startTime: row.exam.startTime ?? null,
				endTime: row.exam.endTime ?? null,
				location: null,
				sourceIdentifier,
			});
		}
	}

	const complete = warnings.length === 0 && courseOfferings.length > 0;

	return {
		sourceKey: request.sourceKey || sourceKey,
		fetchedAt: new Date(),
		complete,
		term,
		levels: levelEntities,
		fields: fieldEntities,
		programs: programEntities,
		programOfferings: programOfferingEntities,
		courses: courseEntities,
		instructors: instructorEntities,
		courseOfferings,
		scheduleExceptions: [],
		examinations,
		warnings,
	};
}
