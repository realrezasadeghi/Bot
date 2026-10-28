import type {
	AcademicLevel,
	AcademicProgram,
	AcademicTerm,
	Course,
	CourseOffering,
	FieldOfStudy,
	Instructor,
	MeetingPattern,
	ProgramOffering,
} from '../../../domain/academic/entities.js';
import type { ScheduleException } from '../../../domain/academic/schedule-exception.js';
import type {
	CourseOfferingView,
	ProgramOfferingView,
} from '../../dto/read-models.js';

export interface ProgramOfferingFilter {
	termId?: string;
	levelId?: string;
	fieldOfStudyId?: string;
}

export interface AcademicCatalogRepository {
	upsertLevel(level: AcademicLevel): Promise<AcademicLevel>;
	upsertFieldOfStudy(field: FieldOfStudy): Promise<FieldOfStudy>;
	upsertTerm(term: AcademicTerm): Promise<AcademicTerm>;
	upsertProgram(program: AcademicProgram): Promise<AcademicProgram>;
	upsertProgramOffering(offering: ProgramOffering): Promise<ProgramOffering>;
	upsertCourse(course: Course): Promise<Course>;
	upsertInstructor(instructor: Instructor): Promise<Instructor>;
	upsertCourseOffering(offering: CourseOffering): Promise<CourseOffering>;
	upsertMeetingPattern(pattern: MeetingPattern): Promise<MeetingPattern>;
	upsertScheduleException(
		exception: ScheduleException,
	): Promise<ScheduleException>;

	deactivateMeetingPatternsNotIn(
		courseOfferingId: string,
		keepPatternIds: ReadonlyArray<string>,
	): Promise<string[]>;

	deactivateCourseOfferingsNotIn(
		termId: string,
		keepCourseOfferingIds: ReadonlyArray<string>,
	): Promise<string[]>;

	deleteScheduleExceptionsNotIn(
		termId: string,
		keepNaturalKeys: ReadonlyArray<string>,
	): Promise<number>;

	listLevels(): Promise<AcademicLevel[]>;
	listFieldsOfStudy(levelId?: string): Promise<FieldOfStudy[]>;
	listTerms(): Promise<AcademicTerm[]>;
	getTermById(id: string): Promise<AcademicTerm | null>;
	getTermByExternalCode(externalCode: string): Promise<AcademicTerm | null>;
	listProgramOfferings(
		filter?: ProgramOfferingFilter,
	): Promise<ProgramOfferingView[]>;
	getProgramOffering(id: string): Promise<ProgramOfferingView | null>;
	listProgramCourseOfferingIds(programOfferingId: string): Promise<string[]>;
	listCourseOfferingsByTerm(termId: string): Promise<CourseOfferingView[]>;
	listCourseOfferingsByIds(
		courseOfferingIds: ReadonlyArray<string>,
	): Promise<CourseOfferingView[]>;
	getCourseOffering(id: string): Promise<CourseOfferingView | null>;
	listMeetingPatternsByCourseOfferingIds(
		courseOfferingIds: ReadonlyArray<string>,
	): Promise<MeetingPattern[]>;
	listScheduleExceptionsByCourseOfferingIds(
		courseOfferingIds: ReadonlyArray<string>,
	): Promise<ScheduleException[]>;
	listCourseOfferingIdsByTerm(termId: string): Promise<string[]>;
}
