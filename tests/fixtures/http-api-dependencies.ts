import pino from 'pino';
import { vi } from 'vitest';
import type {
	HttpApiDependencies,
	WebhookPlatform,
} from '../../src/adapters/inbound/http/http-dependencies.js';
import { PinoLoggerAdapter } from '../../src/adapters/outbound/system/logger.js';
import type { SendMessageResult } from '../../src/application/dto/messaging.js';
import type {
	Repositories,
	UnitOfWork,
} from '../../src/application/ports/outbound/unit-of-work.js';
import type { SyncAcademicTermResult } from '../../src/application/use-cases/academic/sync-academic-term.js';
import { SyncRunStatus } from '../../src/domain/academic/sync-run.js';
import { PlatformCode } from '../../src/domain/identity/platform-identity.js';

export const syncRunStatsFixture = {
	levels: 1,
	fields: 2,
	terms: 1,
	programs: 3,
	programOfferings: 4,
	courses: 5,
	instructors: 6,
	courseOfferings: 7,
	meetingPatterns: 8,
	scheduleExceptions: 0,
	examinations: 1,
	occurrencesCreated: 10,
	occurrencesUpdated: 2,
	occurrencesCancelled: 1,
	warnings: 0,
};

export const syncRunFixture = {
	id: 'sync-run-1',
	sourceKey: 'eqbal-portal',
	status: SyncRunStatus.Completed,
	startedAt: new Date('2026-01-01T00:00:00.000Z'),
	finishedAt: new Date('2026-01-01T00:05:00.000Z'),
	stats: syncRunStatsFixture,
	errorSummary: null,
};

export const occurrencesFixture = {
	created: 3,
	updated: 1,
	cancelled: 0,
	createdOccurrenceIds: ['occurrence-1', 'occurrence-2', 'occurrence-3'],
	changedOccurrenceIds: ['occurrence-4'],
	cancelledOccurrenceIds: [],
};

export const scheduleRemindersFixture = {
	subscriptionsProcessed: 2,
	selectionsProcessed: 1,
	jobsCreated: 4,
	jobsAlreadyPresent: 1,
	skipped: 0,
};

export const scheduleExamRemindersFixture = {
	enabled: false,
	selectionsProcessed: 1,
	jobsCreated: 0,
	jobsAlreadyPresent: 0,
	skipped: 1,
};

export const dailySummariesFixture = {
	subscriptionsProcessed: 2,
	jobsCreated: 1,
	jobsAlreadyPresent: 0,
	jobsCancelled: 0,
	skipped: 0,
};

export const dispatchFixture = {
	claimed: 5,
	sent: 3,
	retried: 1,
	failed: 0,
	cancelled: 1,
	lockLost: 0,
};

const snapshotFixture = {
	sourceKey: 'eqbal-portal',
	fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
	complete: true,
	term: {
		externalCode: '14051',
		title: 'Test term',
		startsOn: null,
		endsOn: null,
		isActive: true,
	},
	levels: [],
	fields: [],
	programs: [],
	programOfferings: [],
	courses: [],
	instructors: [],
	courseOfferings: [],
	scheduleExceptions: [],
	examinations: [],
	warnings: [],
};

const synchronizationFixture = {
	syncRunId: 'sync-run-1',
	status: SyncRunStatus.Completed,
	stats: syncRunStatsFixture,
	warnings: [],
	complete: true,
	reconcileAbsent: true,
};

const syncAcademicTermFixture: SyncAcademicTermResult = {
	snapshot: snapshotFixture,
	synchronization: synchronizationFixture,
	termId: 'term-1',
	occurrences: occurrencesFixture,
};

const outboundMessageFixture = {
	recipient: {
		platform: PlatformCode.Telegram,
		botScope: 'telegram-main',
		externalUserId: '123',
		externalChatId: '123',
	},
	text: 'Hello',
	buttons: [],
};

export interface FakeHttpDependenciesOptions {
	/** `null` leaves ADMIN_API_TOKEN unset, exercising the 503 path. */
	adminApiToken?: string | null;
	apiDocsEnabled?: boolean;
	/** Platforms that accept inbound webhook updates. */
	webhookPlatforms?: readonly WebhookPlatform[];
}

/**
 * Builds the dependencies of the HTTP driving adapter with test doubles.
 *
 * The fixture mirrors the adapter's dependency contract, not the composition
 * root's container: the adapter never sees the container.
 */
export function createFakeHttpDependencies(
	options: FakeHttpDependenciesOptions = {},
) {
	const pinoLogger = pino({ level: 'silent' });
	const logger = new PinoLoggerAdapter(pinoLogger);

	const adminApiToken =
		options.adminApiToken === null
			? undefined
			: (options.adminApiToken ?? 'test-admin-token');

	const academic = {
		listLevels: vi.fn(async () => []),
		getTermByExternalCode: vi.fn(async (_externalCode?: string) => ({
			id: 'term-1',
		})),
	};
	const syncRuns = {
		findLatest: vi.fn(async (_sourceKey?: string) => syncRunFixture),
	};
	const repositories = { academic, syncRuns } as unknown as Repositories;

	const uow = {
		run: vi.fn(
			async (
				work: (repositories: Repositories) => Promise<unknown>,
			): Promise<unknown> => work(repositories),
		),
	} as unknown as UnitOfWork;

	const syncAcademicTerm = {
		execute: vi.fn(async () => syncAcademicTermFixture),
	};
	const generateClassOccurrences = {
		execute: vi.fn(async () => occurrencesFixture),
	};
	const scheduleClassReminders = {
		execute: vi.fn(async () => scheduleRemindersFixture),
	};
	const scheduleExamReminders = {
		execute: vi.fn(async () => scheduleExamRemindersFixture),
	};
	const generateDailySummaries = {
		execute: vi.fn(async () => dailySummariesFixture),
	};
	const dispatchNotifications = {
		execute: vi.fn(async () => dispatchFixture),
	};
	const handleIncoming = {
		execute: vi.fn(async () => outboundMessageFixture),
	};
	const messaging = {
		send: vi.fn(
			async (_message?: unknown): Promise<SendMessageResult> => ({
				provider: 'telegram',
				providerMessageId: 'message-1',
				delivered: true,
				retryable: false,
				retryAfterMs: null,
				error: null,
			}),
		),
	};

	const dependencies: HttpApiDependencies = {
		config: {
			http: {
				port: 3_000,
				bodyLimit: '1mb',
				adminApiToken,
				apiDocs: {
					enabled: options.apiDocsEnabled ?? true,
					path: '/api/docs',
					openapiPath: '/api/openapi.json',
				},
			},
			log: {
				level: 'silent',
				pretty: false,
				requestBody: false,
				bodyMaxLength: 2_048,
			},
			university: {
				sourceKey: 'eqbal-portal',
				offerUrl: 'https://example.invalid/offer',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 20_000,
			},
		},
		logger,
		pinoLogger,
		uow,
		webhookPlatforms: options.webhookPlatforms ?? [],
		useCases: {
			syncAcademicTerm,
			generateClassOccurrences,
			scheduleClassReminders,
			scheduleExamReminders,
			generateDailySummaries,
			dispatchNotifications,
			handleIncoming,
		},
		messaging,
	};

	return {
		dependencies,
		repositories: { academic, syncRuns },
		uow,
		syncAcademicTerm,
		generateClassOccurrences,
		scheduleClassReminders,
		scheduleExamReminders,
		generateDailySummaries,
		dispatchNotifications,
		handleIncoming,
		messaging,
	};
}

export const telegramPlatform: WebhookPlatform = {
	platform: PlatformCode.Telegram,
	botScope: 'telegram-main',
	webhookSecret: 'telegram-secret',
};

export const balePlatform: WebhookPlatform = {
	platform: PlatformCode.Bale,
	botScope: 'bale-main',
	webhookSecret: 'bale-secret',
};

export const actionableTelegramUpdate = {
	update_id: 123,
	message: {
		message_id: 10,
		from: { id: 456, first_name: 'Test', username: 'test_user' },
		chat: { id: 456, type: 'private' },
		text: '/start',
		date: 1_760_000_000,
	},
};
