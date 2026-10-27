import { z } from 'zod';

const booleanish = z
	.enum(['true', 'false', '1', '0'])
	.transform((value) => value === 'true' || value === '1');

const optionalNonEmpty = z
	.string()
	.trim()
	.optional()
	.transform((value) =>
		value === '' || value === undefined ? undefined : value,
	);

const timeZoneSchema = z
	.string()
	.trim()
	.min(1)
	.refine((value) => {
		try {
			new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
			return true;
		} catch {
			return false;
		}
	}, 'must be a valid IANA time zone');

const localTimeSchema = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm');

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	LOG_LEVEL: z
		.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
		.default('info'),
	LOG_PRETTY: booleanish.default(true),
	PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
	HTTP_BODY_LIMIT: z.string().default('1mb'),
	ADMIN_API_TOKEN: optionalNonEmpty,

	DATABASE_URL: z
		.string()
		.min(1)
		.default('postgres://academic:academic@localhost:5432/academic_scheduling'),
	DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

	APP_TIMEZONE: timeZoneSchema.default('Asia/Tehran'),
	DEFAULT_LOCALE: z.string().default('fa-IR'),

	UNIVERSITY_SOURCE_KEY: z.string().default('eqbal-portal'),
	UNIVERSITY_OFFER_URL: z
		.url()
		.default(
			'https://portal.eqbal.ac.ir/Subsystem/Amozesh/Programming/Silabes/Offer/OfferShow/OfferShow.aspx',
		),
	UNIVERSITY_QUERY_PARAM: optionalNonEmpty,
	UNIVERSITY_QUERY_R: optionalNonEmpty,
	UNIVERSITY_TERM_CODE: z.string().trim().min(1).default('14051'),
	UNIVERSITY_VIEWSTATE_GENERATOR: z.string().default('AF036D42'),
	UNIVERSITY_GRID_INFO: z.string().default('0;1;1;1;;;onGridLoad;1;;;'),
	UNIVERSITY_CHK_MAIN: booleanish.default(true),
	UNIVERSITY_REQUEST_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.min(1_000)
		.max(120_000)
		.default(20_000),
	UNIVERSITY_HTML_FIXTURE_PATH: optionalNonEmpty,

	TELEGRAM_BOT_TOKEN: optionalNonEmpty,
	TELEGRAM_BOT_SCOPE: z.string().default('telegram-main'),
	TELEGRAM_WEBHOOK_SECRET: optionalNonEmpty,
	TELEGRAM_API_BASE_URL: z.url().default('https://api.telegram.org'),

	BALE_BOT_TOKEN: optionalNonEmpty,
	BALE_BOT_SCOPE: z.string().default('bale-main'),
	BALE_WEBHOOK_SECRET: optionalNonEmpty,
	BALE_API_BASE_URL: z.url().default('https://tapi.bale.ai'),

	WORKER_ID: optionalNonEmpty,
	WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(5_000),
	WORKER_SCHEDULER_INTERVAL_MS: z.coerce
		.number()
		.int()
		.min(1_000)
		.default(60_000),
	WORKER_LOCK_TIMEOUT_MS: z.coerce.number().int().min(10_000).default(120_000),
	WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(20),

	OCCURRENCE_HORIZON_DAYS: z.coerce.number().int().min(1).max(120).default(14),
	REMINDER_HORIZON_DAYS: z.coerce.number().int().min(1).max(60).default(7),
	SUMMARY_HORIZON_DAYS: z.coerce.number().int().min(1).max(14).default(2),
	SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1_440).default(60),

	DEFAULT_REMINDER_OFFSET_MINUTES: z.coerce
		.number()
		.int()
		.min(0)
		.max(720)
		.default(60),
	DEFAULT_DAILY_SUMMARY_TIME: localTimeSchema.default('08:00'),
	DEFAULT_TIMEZONE: timeZoneSchema.default('Asia/Tehran'),
});

export type AppConfig = Readonly<{
	nodeEnv: z.infer<typeof envSchema>['NODE_ENV'];
	log: {
		level: z.infer<typeof envSchema>['LOG_LEVEL'];
		pretty: boolean;
	};
	http: {
		port: number;
		bodyLimit: string;
		adminApiToken?: string;
	};
	database: {
		url: string;
		poolMax: number;
	};
	app: {
		timeZone: string;
		locale: string;
	};
	university: {
		sourceKey: string;
		offerUrl: string;
		queryParam?: string;
		queryR?: string;
		termCode: string;
		viewStateGenerator: string;
		gridInfo: string;
		chkMain: boolean;
		requestTimeoutMs: number;
		fixturePath?: string;
	};
	telegram?: {
		token: string;
		botScope: string;
		webhookSecret?: string;
		apiBaseUrl: string;
	};
	bale?: {
		token: string;
		botScope: string;
		webhookSecret?: string;
		apiBaseUrl: string;
	};
	worker: {
		id: string;
		pollIntervalMs: number;
		schedulerIntervalMs: number;
		lockTimeoutMs: number;
		batchSize: number;
	};
	scheduling: {
		occurrenceHorizonDays: number;
		reminderHorizonDays: number;
		summaryHorizonDays: number;
		syncIntervalMinutes: number;
		defaultReminderOffsetMinutes: number;
		defaultDailySummaryTime: string;
		defaultTimeZone: string;
	};
}>;

export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
	const parsed = envSchema.safeParse(env);
	if (!parsed.success) {
		const details = parsed.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		throw new ConfigurationError(`Invalid environment configuration: ${details}`);
	}

	const value = parsed.data;
	const workerId =
		value.WORKER_ID ?? `${process.env.HOSTNAME ?? 'worker'}-${process.pid}`;

	return Object.freeze({
		nodeEnv: value.NODE_ENV,
		log: {
			level: value.LOG_LEVEL,
			pretty: value.LOG_PRETTY,
		},
		http: {
			port: value.PORT,
			bodyLimit: value.HTTP_BODY_LIMIT,
			adminApiToken: value.ADMIN_API_TOKEN,
		},
		database: {
			url: value.DATABASE_URL,
			poolMax: value.DATABASE_POOL_MAX,
		},
		app: {
			timeZone: value.APP_TIMEZONE,
			locale: value.DEFAULT_LOCALE,
		},
		university: {
			sourceKey: value.UNIVERSITY_SOURCE_KEY,
			offerUrl: value.UNIVERSITY_OFFER_URL,
			queryParam: value.UNIVERSITY_QUERY_PARAM,
			queryR: value.UNIVERSITY_QUERY_R,
			termCode: value.UNIVERSITY_TERM_CODE,
			viewStateGenerator: value.UNIVERSITY_VIEWSTATE_GENERATOR,
			gridInfo: value.UNIVERSITY_GRID_INFO,
			chkMain: value.UNIVERSITY_CHK_MAIN,
			requestTimeoutMs: value.UNIVERSITY_REQUEST_TIMEOUT_MS,
			fixturePath: value.UNIVERSITY_HTML_FIXTURE_PATH,
		},
		telegram: value.TELEGRAM_BOT_TOKEN
			? {
					token: value.TELEGRAM_BOT_TOKEN,
					botScope: value.TELEGRAM_BOT_SCOPE,
					webhookSecret: value.TELEGRAM_WEBHOOK_SECRET,
					apiBaseUrl: value.TELEGRAM_API_BASE_URL,
				}
			: undefined,
		bale: value.BALE_BOT_TOKEN
			? {
					token: value.BALE_BOT_TOKEN,
					botScope: value.BALE_BOT_SCOPE,
					webhookSecret: value.BALE_WEBHOOK_SECRET,
					apiBaseUrl: value.BALE_API_BASE_URL,
				}
			: undefined,
		worker: {
			id: workerId,
			pollIntervalMs: value.WORKER_POLL_INTERVAL_MS,
			schedulerIntervalMs: value.WORKER_SCHEDULER_INTERVAL_MS,
			lockTimeoutMs: value.WORKER_LOCK_TIMEOUT_MS,
			batchSize: value.WORKER_BATCH_SIZE,
		},
		scheduling: {
			occurrenceHorizonDays: value.OCCURRENCE_HORIZON_DAYS,
			reminderHorizonDays: value.REMINDER_HORIZON_DAYS,
			summaryHorizonDays: value.SUMMARY_HORIZON_DAYS,
			syncIntervalMinutes: value.SYNC_INTERVAL_MINUTES,
			defaultReminderOffsetMinutes: value.DEFAULT_REMINDER_OFFSET_MINUTES,
			defaultDailySummaryTime: value.DEFAULT_DAILY_SUMMARY_TIME,
			defaultTimeZone: value.DEFAULT_TIMEZONE,
		},
	});
}

export function assertUniversityRequestConfig(
	config: AppConfig['university'],
): asserts config is AppConfig['university'] & {
	queryParam: string;
	queryR: string;
} {
	if (config.fixturePath) return;
	if (!config.queryParam || !config.queryR) {
		throw new ConfigurationError(
			'UNIVERSITY_QUERY_PARAM and UNIVERSITY_QUERY_R are required to call the university endpoint. ' +
				'Set them from the observed request, or set UNIVERSITY_HTML_FIXTURE_PATH for offline parsing.',
		);
	}
}
