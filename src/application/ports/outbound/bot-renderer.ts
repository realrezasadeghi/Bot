import type {
	AcademicLevel,
	AcademicTerm,
	FieldOfStudy,
} from '../../../domain/academic/entities.js';
import type {
	StudyField,
	UserAcademicSelection,
} from '../../../domain/academic/study-field.js';
import type {
	OutboundMessage,
	OutboundRecipient,
} from '../../dto/messaging.js';
import type {
	CourseOfferingView,
	ExaminationEntryDto,
} from '../../dto/read-models.js';
import type {
	DailyScheduleDto,
	ProgramSummaryDto,
	SubscriptionDto,
	WeeklyScheduleDto,
} from '../../dto/schedule.js';
import type { ProgramCoursesDto } from '../../use-cases/subscriptions/get-subscription.js';

export interface BotRenderer {
	welcome(recipient: OutboundRecipient): OutboundMessage;
	mainMenu(recipient: OutboundRecipient): OutboundMessage;
	help(recipient: OutboundRecipient): OutboundMessage;

	dailySchedule(
		schedule: DailyScheduleDto,
		recipient: OutboundRecipient,
	): OutboundMessage;
	weeklySchedule(
		schedule: WeeklyScheduleDto,
		recipient: OutboundRecipient,
	): OutboundMessage;
	examinations(
		examinations: ReadonlyArray<ExaminationEntryDto>,
		recipient: OutboundRecipient,
	): OutboundMessage;

	subscription(
		subscription: SubscriptionDto | null,
		recipient: OutboundRecipient,
	): OutboundMessage;
	preferences(
		subscription: SubscriptionDto,
		recipient: OutboundRecipient,
	): OutboundMessage;
	studentPreferences(
		selection: UserAcademicSelection,
		recipient: OutboundRecipient,
	): OutboundMessage;

	fields(
		fields: ReadonlyArray<FieldOfStudy>,
		recipient: OutboundRecipient,
	): OutboundMessage;
	levels(
		levels: ReadonlyArray<AcademicLevel>,
		recipient: OutboundRecipient,
	): OutboundMessage;
	studyLevels(
		levels: ReadonlyArray<AcademicLevel>,
		recipient: OutboundRecipient,
	): OutboundMessage;
	studyFields(
		fields: ReadonlyArray<StudyField>,
		recipient: OutboundRecipient,
	): OutboundMessage;
	studyTerms(
		terms: ReadonlyArray<AcademicTerm>,
		recipient: OutboundRecipient,
	): OutboundMessage;
	terms(
		terms: ReadonlyArray<AcademicTerm>,
		recipient: OutboundRecipient,
	): OutboundMessage;
	programs(
		programs: ReadonlyArray<ProgramSummaryDto>,
		recipient: OutboundRecipient,
	): OutboundMessage;

	courseOfferings(
		offerings: ReadonlyArray<CourseOfferingView>,
		selectedCourseOfferingIds: ReadonlySet<string>,
		recipient: OutboundRecipient,
	): OutboundMessage;
	programCourses(
		courses: ProgramCoursesDto,
		selectedCourseOfferingIds?: ReadonlySet<string>,
		recipient?: OutboundRecipient,
	): OutboundMessage;

	unresolvedProgramGrouping(recipient: OutboundRecipient): OutboundMessage;
	needSubscription(recipient: OutboundRecipient): OutboundMessage;
	restartFlow(recipient: OutboundRecipient): OutboundMessage;
	unsubscribeConfirm(
		subscriptionTitle: string,
		recipient: OutboundRecipient,
	): OutboundMessage;
}
