import type { Logger as PinoLogger } from 'pino';
import type { IncomingPlatformEvent } from '../../../application/dto/incoming.js';
import type { OutboundMessage } from '../../../application/dto/messaging.js';
import type { Logger } from '../../../application/ports/outbound/logger.js';
import type { MessagingPort } from '../../../application/ports/outbound/messaging.js';
import type { UnitOfWork } from '../../../application/ports/outbound/unit-of-work.js';
import type { UniversitySourceRequest } from '../../../application/ports/outbound/university-source.js';
import type { SyncAcademicTermResult } from '../../../application/use-cases/academic/sync-academic-term.js';
import type { DispatchResult } from '../../../application/use-cases/notifications/dispatch-due-notifications.js';
import type { GenerateDailySummariesResult } from '../../../application/use-cases/notifications/generate-daily-summaries.js';
import type { ScheduleRemindersResult } from '../../../application/use-cases/notifications/schedule-class-reminders.js';
import type { ScheduleExamRemindersResult } from '../../../application/use-cases/notifications/schedule-exam-reminders.js';
import type { GenerateOccurrencesResult } from '../../../application/use-cases/scheduling/generate-class-occurrences.js';
import type { AppConfig } from '../../../config/env.js';
import type { PlatformCode } from '../../../domain/identity/platform-identity.js';
import type { LocalDate } from '../../../domain/shared/local-date.js';

/**
 * A messaging platform that accepts inbound webhook updates.
 *
 * The composition root resolves the platform configuration into these
 * bindings, so the HTTP adapter never reads the environment directly.
 */
export interface WebhookPlatform {
	platform: PlatformCode;
	botScope: string;
	/** Shared secret expected in the webhook secret header, when configured. */
	webhookSecret?: string;
}

/*
 * The HTTP adapter consumes the application through narrow ports. Declaring
 * them here (instead of depending on the use-case classes) keeps the adapter
 * independent of the application's implementation and trivially testable.
 */
export interface AcademicSyncUseCase {
	execute(request: UniversitySourceRequest): Promise<SyncAcademicTermResult>;
}

export interface OccurrenceGenerator {
	execute(input: {
		termId: string;
		from?: LocalDate;
		to?: LocalDate;
		reconcileAbsent: boolean;
	}): Promise<GenerateOccurrencesResult>;
}

export interface ClassReminderScheduler {
	execute(input?: { userId?: string }): Promise<ScheduleRemindersResult>;
}

export interface ExamReminderScheduler {
	execute(): Promise<ScheduleExamRemindersResult>;
}

export interface DailySummaryGenerator {
	execute(input?: { userId?: string }): Promise<GenerateDailySummariesResult>;
}

export interface NotificationDispatcher {
	execute(): Promise<DispatchResult>;
}

export interface IncomingMessageHandler {
	execute(event: IncomingPlatformEvent): Promise<OutboundMessage | null>;
}

/** The use cases the HTTP API exposes. */
export interface HttpUseCases {
	syncAcademicTerm: AcademicSyncUseCase;
	generateClassOccurrences: OccurrenceGenerator;
	scheduleClassReminders: ClassReminderScheduler;
	scheduleExamReminders: ExamReminderScheduler;
	generateDailySummaries: DailySummaryGenerator;
	dispatchNotifications: NotificationDispatcher;
	handleIncoming: IncomingMessageHandler;
}

/**
 * Everything the HTTP driving adapter needs.
 *
 * The adapter depends on application ports and use cases only — never on the
 * composition root. The composition root builds this object and hands it over.
 */
export interface HttpApiDependencies {
	config: {
		http: AppConfig['http'];
		log: AppConfig['log'];
		university: AppConfig['university'];
	};
	/** Application logger (structured, framework independent). */
	logger: Logger;
	/** Raw pino instance used by the HTTP request logger. */
	pinoLogger: PinoLogger;
	/** Transactional access to the repositories. */
	uow: UnitOfWork;
	/** Platforms that accept inbound webhook updates. */
	webhookPlatforms: readonly WebhookPlatform[];
	useCases: HttpUseCases;
	messaging: MessagingPort;
}
