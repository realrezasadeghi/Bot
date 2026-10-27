/**
 * Normalized output of the university HTML adapter.
 *
 * The shape is intentionally independent of ASP.NET, Cheerio and the portal's
 * table layout. External keys are the stable identifiers used to reconcile
 * repeated imports.
 */
export interface UniversityTermDto {
  externalCode: string;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
}

export interface UniversityLevelDto {
  externalKey: string;
  code: string;
  title: string;
}

export interface UniversityFieldDto {
  externalKey: string;
  levelExternalKey: string;
  code: string;
  title: string;
}

export interface UniversityProgramDto {
  externalKey: string;
  levelExternalKey: string;
  fieldExternalKey: string;
  code: string;
  title: string;
}

export interface UniversityProgramOfferingDto {
  externalKey: string;
  programExternalKey: string;
  termExternalCode: string;
  title: string;
}

export interface UniversityCourseDto {
  externalKey: string;
  code: string;
  title: string;
  units: number | null;
}

export interface UniversityInstructorDto {
  externalKey: string;
  fullName: string;
}

export interface UniversityMeetingPatternDto {
  weekday: number;
  startTime: string;
  endTime: string;
  location: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface UniversityScheduleExceptionDto {
  externalKey: string | null;
  courseOfferingExternalKey: string;
  meetingPatternIndex: number | null;
  date: string;
  type: "CANCELLED" | "RESCHEDULED" | "TIME_CHANGED" | "LOCATION_CHANGED";
  newStartTime: string | null;
  newEndTime: string | null;
  newLocation: string | null;
  reason: string | null;
}

export interface UniversityCourseOfferingDto {
  externalKey: string;
  courseExternalKey: string;
  termExternalCode: string;
  programOfferingExternalKey: string | null;
  sectionCode: string | null;
  instructorExternalKeys: string[];
  location: string | null;
  meetingPatterns: UniversityMeetingPatternDto[];
}

export interface UniversityAcademicSnapshot {
  sourceKey: string;
  fetchedAt: Date;
  /**
   * False when the adapter could not prove that the response represents the
   * complete table (empty table, suspicious error page, unparsed rows). The
   * synchronizer will not reconcile absent records when this is false.
   */
  complete: boolean;
  term: UniversityTermDto;
  levels: UniversityLevelDto[];
  fields: UniversityFieldDto[];
  programs: UniversityProgramDto[];
  programOfferings: UniversityProgramOfferingDto[];
  courses: UniversityCourseDto[];
  instructors: UniversityInstructorDto[];
  courseOfferings: UniversityCourseOfferingDto[];
  scheduleExceptions: UniversityScheduleExceptionDto[];
  warnings: string[];
}

export class UniversitySnapshotValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "UniversitySnapshotValidationError";
  }
}
