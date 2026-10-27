import type { ClassOccurrence } from '../../domain/academic/class-occurrence.js';
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
} from '../../domain/academic/entities.js';
import type { NotificationPreference } from '../../domain/subscriptions/notification-preference.js';
import type { UserProgramSubscription } from '../../domain/subscriptions/subscription.js';

export interface ProgramOfferingView {
	programOffering: ProgramOffering;
	program: AcademicProgram;
	level: AcademicLevel;
	field: FieldOfStudy;
	term: AcademicTerm;
	courseOfferingIds: string[];
}

export interface CourseOfferingView {
	courseOffering: CourseOffering;
	course: Course;
	instructors: Instructor[];
	patterns: MeetingPattern[];
}

export interface ScheduleOccurrenceView {
	occurrence: ClassOccurrence;
	courseOffering: CourseOffering;
	course: Course;
	instructors: Instructor[];
}

export interface SubscriptionView {
	subscription: UserProgramSubscription;
	preference: NotificationPreference;
	programOffering: ProgramOfferingView;
}
