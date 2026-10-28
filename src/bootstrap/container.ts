import { PlatformMessagingRouter } from '../adapters/outbound/messaging/platform-router.js';
import { TelegramCompatibleMessagingAdapter } from '../adapters/outbound/messaging/telegram-compatible.js';
import { PostgresConversationStateStore } from '../adapters/outbound/persistence/postgres/conversation-state-store.js';
import { createPostgresConnection } from '../adapters/outbound/persistence/postgres/db.js';
import { PostgresStudentSelectionRepository } from '../adapters/outbound/persistence/postgres/student-selection-repository.js';
import { PostgresStudyFieldOfferingMappingRepository } from '../adapters/outbound/persistence/postgres/study-field-offering-mapping-repository.js';
import { PostgresStudyFieldRepository } from '../adapters/outbound/persistence/postgres/study-field-repository.js';
import { PostgresUnitOfWork } from '../adapters/outbound/persistence/postgres/unit-of-work.js';
import { SystemClock } from '../adapters/outbound/system/clock.js';
import { UuidGenerator } from '../adapters/outbound/system/id-generator.js';
import { createLogger } from '../adapters/outbound/system/logger.js';
import { FixtureUniversitySource } from '../adapters/outbound/university/fixture-source.js';
import { HTMLUniversitySource } from '../adapters/outbound/university/html-source.js';
import { UnavailableUniversitySource } from '../adapters/outbound/university/unavailable-source.js';
import type { Logger } from '../application/ports/outbound/logger.js';
import type { MessagingPort } from '../application/ports/outbound/messaging.js';
import type { StudentSelectionRepository } from '../application/ports/outbound/student-selection-repository.js';
import type { StudyFieldOfferingMappingRepository } from '../application/ports/outbound/study-field-offering-mapping-repository.js';
import type { StudyFieldRepository } from '../application/ports/outbound/study-field-repository.js';
import type { UniversityAcademicSource } from '../application/ports/outbound/university-source.js';
import {
	GetAvailableFields,
	GetAvailableLevels,
	GetAvailablePrograms,
} from '../application/use-cases/academic/get-academic-options.js';
import { GetAvailableCourseOfferings } from '../application/use-cases/academic/get-available-course-offerings.js';
import { GetAvailableTerms } from '../application/use-cases/academic/get-available-terms.js';
import { GetStudentTimetable } from '../application/use-cases/academic/get-student-timetable.js';
import { GetUpcomingExaminations } from '../application/use-cases/academic/get-upcoming-examinations.js';
import { GetStudyFields } from '../application/use-cases/academic/get-study-fields.js';
import { ImportUniversityAcademicData } from '../application/use-cases/academic/import-university-academic-data.js';
import { SaveStudentCourseSelection } from '../application/use-cases/academic/save-student-course-selection.js';
import { SynchronizeAcademicData } from '../application/use-cases/academic/synchronize-academic-data.js';
import { UpdateStudentCourseSelection } from '../application/use-cases/academic/update-student-course-selection.js';
import { UpdateStudentNotificationPreferences } from '../application/use-cases/academic/update-student-notification-preferences.js';
import { RegisterOrResolveUser } from '../application/use-cases/identity/register-or-resolve-user.js';
import { HandleIncomingPlatformMessage } from '../application/use-cases/messaging/handle-incoming-platform-message.js';
import { DispatchDueNotifications } from '../application/use-cases/notifications/dispatch-due-notifications.js';
import { GenerateDailySummaries } from '../application/use-cases/notifications/generate-daily-summaries.js';
import { ScheduleClassReminders } from '../application/use-cases/notifications/schedule-class-reminders.js';
import { ScheduleExamReminders } from '../application/use-cases/notifications/schedule-exam-reminders.js';
import { GenerateClassOccurrences } from '../application/use-cases/scheduling/generate-class-occurrences.js';
import {
	GetDailySchedule,
	GetWeeklySchedule,
} from '../application/use-cases/scheduling/get-schedules.js';
import {
	CustomizeCourseSelection,
	FollowProgramDefault,
} from '../application/use-cases/subscriptions/customize-course-selection.js';
import {
	GetCurrentSubscription,
	GetProgramCourses,
} from '../application/use-cases/subscriptions/get-subscription.js';
import {
	SubscribeToProgram,
	type SubscriptionDefaults,
} from '../application/use-cases/subscriptions/subscribe-to-program.js';
import { UnsubscribeFromProgram } from '../application/use-cases/subscriptions/unsubscribe-from-program.js';
import { UpdateNotificationPreferences } from '../application/use-cases/subscriptions/update-notification-preferences.js';
import type { AppConfig } from '../config/env.js';
import { PlatformCode } from '../domain/identity/platform-identity.js';

export interface AppContainer {
	config: AppConfig;
	logger: Logger;
	uow: PostgresUnitOfWork;
	stateStore: PostgresConversationStateStore;
	clock: SystemClock;
	ids: UuidGenerator;
	messaging: PlatformMessagingRouter;
	configuredPlatforms: ReadonlySet<PlatformCode>;
	universitySource: UniversityAcademicSource;
	studyFields: StudyFieldRepository;
	studyFieldOfferingMappings: StudyFieldOfferingMappingRepository;
	studentSelections: StudentSelectionRepository;
	getStudyFields: GetStudyFields;
	getAvailableCourseOfferings: GetAvailableCourseOfferings;
	saveStudentCourseSelection: SaveStudentCourseSelection;
	getStudentTimetable: GetStudentTimetable;
	getUpcomingExaminations: GetUpcomingExaminations;
	updateStudentCourseSelection: UpdateStudentCourseSelection;
	updateStudentNotificationPreferences: UpdateStudentNotificationPreferences;
	handleIncoming: HandleIncomingPlatformMessage;
	dispatchNotifications: DispatchDueNotifications;
	scheduleClassReminders: ScheduleClassReminders;
	scheduleExamReminders: ScheduleExamReminders;
	generateDailySummaries: GenerateDailySummaries;
	generateClassOccurrences: GenerateClassOccurrences;
	importUniversityData: ImportUniversityAcademicData;
	synchronizeAcademicData: SynchronizeAcademicData;
	close(): Promise<void>;
}

function createUniversitySource(config: AppConfig): UniversityAcademicSource {
	if (config.university.queryParam && config.university.queryR) {
		return new HTMLUniversitySource({
			sourceKey: config.university.sourceKey,
			offerUrl: config.university.offerUrl,
			queryParam: config.university.queryParam,
			queryR: config.university.queryR,
			termCode: config.university.termCode,
			viewStateGenerator: config.university.viewStateGenerator,
			gridInfo: config.university.gridInfo,
			chkMain: config.university.chkMain,
			requestTimeoutMs: config.university.requestTimeoutMs,
			cookie: config.university.cookie,
		});
	}

	if (config.university.fixturePath) {
		return new FixtureUniversitySource(config.university.fixturePath);
	}

	return new UnavailableUniversitySource();
}

export function createAppContainer(config: AppConfig): AppContainer {
	const logger = createLogger(
		config.log.level,
		config.log.pretty,
		config.nodeEnv,
	);
	const clock = new SystemClock();
	const ids = new UuidGenerator();
	const connection = createPostgresConnection({
		connectionString: config.database.url,
		max: config.database.poolMax,
	});
	const uow = new PostgresUnitOfWork(connection.db);
	const stateStore = new PostgresConversationStateStore(connection.db);

	const adapters = new Map<PlatformCode, MessagingPort>();

	if (config.telegram) {
		adapters.set(
			PlatformCode.Telegram,
			new TelegramCompatibleMessagingAdapter({
				platform: PlatformCode.Telegram,
				token: config.telegram.token,
				apiBaseUrl: config.telegram.apiBaseUrl,
			}),
		);
	}

	if (config.bale) {
		adapters.set(
			PlatformCode.Bale,
			new TelegramCompatibleMessagingAdapter({
				platform: PlatformCode.Bale,
				token: config.bale.token,
				apiBaseUrl: config.bale.apiBaseUrl,
			}),
		);
	}

	const messaging = new PlatformMessagingRouter(adapters);

	const defaults: SubscriptionDefaults = {
		dailySummaryTime: config.scheduling.defaultDailySummaryTime,
		reminderOffsetMinutes: config.scheduling.defaultReminderOffsetMinutes,
		notifyOnEmptyDays: false,
	};

	const registerOrResolveUser = new RegisterOrResolveUser({
		uow,
		ids,
		clock,
		logger,
		defaultTimeZone: config.scheduling.defaultTimeZone,
		defaultLocale: config.app.locale,
	});
	const getAvailableTerms = new GetAvailableTerms(uow);
	const getAvailableLevels = new GetAvailableLevels(uow);
	const getAvailableFields = new GetAvailableFields(uow);
	const getAvailablePrograms = new GetAvailablePrograms(uow);
	const getDailySchedule = new GetDailySchedule({ uow, clock });
	const getWeeklySchedule = new GetWeeklySchedule({ uow, clock });
	const getUpcomingExaminations = new GetUpcomingExaminations({
		uow,
		clock,
	});
	const getCurrentSubscription = new GetCurrentSubscription(uow);
	const getProgramCourses = new GetProgramCourses(uow);
	const subscribeToProgram = new SubscribeToProgram({
		uow,
		ids,
		clock,
		defaults,
	});
	const customizeCourseSelection = new CustomizeCourseSelection({
		uow,
		ids,
		clock,
		defaults,
	});
	const followProgramDefault = new FollowProgramDefault({ uow, clock });
	const updateNotificationPreferences = new UpdateNotificationPreferences({
		uow,
		ids,
		clock,
		defaults,
	});
	const unsubscribeFromProgram = new UnsubscribeFromProgram({ uow, clock });
	const getStudyFields = new GetStudyFields(uow);
	const getAvailableCourseOfferings = new GetAvailableCourseOfferings(uow);
	const saveStudentCourseSelection = new SaveStudentCourseSelection({
		uow,
		ids,
		clock,
	});
	const getStudentTimetable = new GetStudentTimetable({ uow, clock });
	const updateStudentCourseSelection = new UpdateStudentCourseSelection({
		uow,
		ids,
		clock,
	});
	const updateStudentNotificationPreferences =
		new UpdateStudentNotificationPreferences({ uow, clock });

	const handleIncoming = new HandleIncomingPlatformMessage({
		uow,
		clock,
		logger,
		stateStore,
		registerOrResolveUser,
		getAvailableTerms,
		getAvailableLevels,
		getAvailableFields,
		getAvailablePrograms,
		getDailySchedule,
		getWeeklySchedule,
		getUpcomingExaminations,
		getStudyFields,
		getAvailableCourseOfferings,
		saveStudentCourseSelection,
		updateStudentNotificationPreferences,
		getCurrentSubscription,
		getProgramCourses,
		subscribeToProgram,
		customizeCourseSelection,
		followProgramDefault,
		updateNotificationPreferences,
		unsubscribeFromProgram,
	});

	const dispatchNotifications = new DispatchDueNotifications({
		uow,
		clock,
		ids,
		logger,
		messaging,
		workerId: config.worker.id,
		lockTimeoutMs: config.worker.lockTimeoutMs,
		batchSize: config.worker.batchSize,
	});
	const scheduleClassReminders = new ScheduleClassReminders({
		uow,
		ids,
		clock,
		logger,
		horizonDays: config.scheduling.reminderHorizonDays,
	});
	const scheduleExamReminders = new ScheduleExamReminders({
		uow,
		ids,
		clock,
		logger,
		enabled: config.scheduling.examRemindersEnabled,
		horizonDays: config.scheduling.reminderHorizonDays,
		offsetsMinutes: config.scheduling.examReminderOffsetsMinutes,
	});
	const generateDailySummaries = new GenerateDailySummaries({
		uow,
		ids,
		clock,
		logger,
		horizonDays: config.scheduling.summaryHorizonDays,
	});
	const generateClassOccurrences = new GenerateClassOccurrences({
		uow,
		ids,
		clock,
		logger,
		horizonDays: config.scheduling.occurrenceHorizonDays,
		appTimeZone: config.app.timeZone,
	});
	const universitySource = createUniversitySource(config);
	const importUniversityData = new ImportUniversityAcademicData({
		source: universitySource,
		logger,
	});
	const synchronizeAcademicData = new SynchronizeAcademicData({
		uow,
		ids,
		clock,
		logger,
	});
	const studyFields = new PostgresStudyFieldRepository(connection.db);
	const studyFieldOfferingMappings =
		new PostgresStudyFieldOfferingMappingRepository(connection.db);
	const studentSelections = new PostgresStudentSelectionRepository(
		connection.db,
	);

	return {
		config,
		logger,
		uow,
		stateStore,
		clock,
		ids,
		messaging,
		configuredPlatforms: new Set(adapters.keys()),
		universitySource,
		studyFields,
		studyFieldOfferingMappings,
		studentSelections,
		getStudyFields,
		getAvailableCourseOfferings,
		saveStudentCourseSelection,
		getStudentTimetable,
		getUpcomingExaminations,
		updateStudentCourseSelection,
		updateStudentNotificationPreferences,
		handleIncoming,
		dispatchNotifications,
		scheduleClassReminders,
		scheduleExamReminders,
		generateDailySummaries,
		generateClassOccurrences,
		importUniversityData,
		synchronizeAcademicData,
		async close() {
			await connection.pool.end();
		},
	};
}
