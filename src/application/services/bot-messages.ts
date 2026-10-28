import type {
	AcademicLevel,
	AcademicTerm,
	FieldOfStudy,
} from '../../domain/academic/entities.js';
import type {
	StudyField,
	UserAcademicSelection,
} from '../../domain/academic/study-field.js';
import { LocalDate } from '../../domain/shared/local-date.js';
import { WEEKDAY_LABELS_FA } from '../../domain/shared/weekday.js';
import type { OutboundButton } from '../dto/messaging.js';
import type {
	CourseOfferingView,
	ExaminationEntryDto,
} from '../dto/read-models.js';
import type {
	DailyScheduleDto,
	ProgramSummaryDto,
	ScheduleEntryDto,
	SubscriptionDto,
	WeeklyScheduleDto,
} from '../dto/schedule.js';
import type { ProgramCoursesDto } from '../use-cases/subscriptions/get-subscription.js';
import { truncateMessage } from './notification-content.js';

export interface BotContent {
	text: string;
	buttons: OutboundButton[][];
}

const MAIN_MENU: OutboundButton[][] = [
	[
		{ text: 'برنامه امروز', callbackData: 'menu:today' },
		{ text: 'برنامه هفتگی', callbackData: 'menu:week' },
	],
	[{ text: 'انتخاب یا تغییر برنامه', callbackData: 'menu:subscribe' }],
	[{ text: 'انتخاب رشته و دروس', callbackData: 'menu:study' }],
	[{ text: 'برنامه فعلی', callbackData: 'menu:program' }],
	[{ text: 'امتحان‌های پیش رو', callbackData: 'menu:exams' }],
	[{ text: 'تنظیم اعلان‌ها', callbackData: 'menu:prefs' }],
	[{ text: 'راهنما', callbackData: 'menu:help' }],
];

function backToMenu(): OutboundButton[][] {
	return [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]];
}

function weekdayOf(date: string): string {
	const parsed = LocalDate.tryParse(date);
	return parsed ? WEEKDAY_LABELS_FA[parsed.weekday()] : '';
}

function formatEntry(entry: ScheduleEntryDto): string {
	const instructor = entry.instructorName ? ` | ${entry.instructorName}` : '';
	const location = entry.location ? ` | ${entry.location}` : '';
	const cancelled = entry.status === 'CANCELLED' ? ' | لغو شده' : '';
	return `${entry.startTime}-${entry.endTime} | ${entry.courseTitle} (${entry.courseCode})${instructor}${location}${cancelled}`;
}

export function renderWelcome(): BotContent {
	return {
		text: [
			'به ربات برنامه‌ریزی درسی خوش آمدید.',
			'',
			'برای دریافت برنامه، ابتدا یک برنامه تحصیلی انتخاب کنید.',
			'از منوی زیر شروع کنید.',
		].join('\n'),
		buttons: MAIN_MENU,
	};
}

export function renderMainMenu(): BotContent {
	return {
		text: 'منوی اصلی',
		buttons: MAIN_MENU,
	};
}

export function renderHelp(): BotContent {
	return {
		text: [
			'دستورهای موجود:',
			'/start شروع و منوی اصلی',
			'/today برنامه امروز',
			'/week برنامه هفتگی',
			'/exams امتحان‌های پیش رو',
			'/program برنامه فعلی',
			'/subscribe انتخاب یا تغییر برنامه',
			'/study انتخاب رشته، ترم و دروس',
			'/customize انتخاب دروس',
			'/prefs تنظیم اعلان‌ها',
			'/unsubscribe لغو اشتراک',
			'/cancel انصراف از مرحله فعلی',
			'/help راهنما',
		].join('\n'),
		buttons: backToMenu(),
	};
}

export function renderDailySchedule(schedule: DailyScheduleDto): BotContent {
	if (schedule.classes.length === 0) {
		return {
			text: `برنامه ${weekdayOf(schedule.date)} ${schedule.date}\n\nبرای این روز کلاسی ثبت نشده است.`,
			buttons: MAIN_MENU,
		};
	}

	return {
		text: truncateMessage(
			[
				`برنامه ${weekdayOf(schedule.date)} ${schedule.date}`,
				'',
				...schedule.classes.map((entry) => `- ${formatEntry(entry)}`),
			].join('\n'),
		),
		buttons: MAIN_MENU,
	};
}

export function renderExaminations(
	examinations: ReadonlyArray<ExaminationEntryDto>,
): BotContent {
	if (examinations.length === 0) {
		return {
			text: 'امتحانی برای دروس انتخاب‌شده ثبت نشده است.',
			buttons: MAIN_MENU,
		};
	}

	return {
		text: truncateMessage(
			[
				'امتحان‌های پیش رو',
				'',
				...examinations.map((examination) => {
					const time = examination.startTime
						? ` | ${examination.startTime}${examination.endTime ? `-${examination.endTime}` : ''}`
						: '';
					const location = examination.location
						? ` | ${examination.location}`
						: '';
					return `- ${examination.examDate} | ${examination.courseTitle} (${examination.courseCode})${time}${location}`;
				}),
			].join('\n'),
		),
		buttons: MAIN_MENU,
	};
}

export function renderWeeklySchedule(schedule: WeeklyScheduleDto): BotContent {
	const lines: string[] = [
		`برنامه هفتگی: ${schedule.weekStart} تا ${schedule.weekEnd}`,
		'',
	];

	for (const day of schedule.days) {
		lines.push(`${weekdayOf(day.date)} ${day.date}`);
		if (day.classes.length === 0) {
			lines.push('  بدون کلاس');
		} else {
			for (const entry of day.classes) {
				lines.push(`  - ${formatEntry(entry)}`);
			}
		}
		lines.push('');
	}

	return {
		text: truncateMessage(lines.join('\n')),
		buttons: MAIN_MENU,
	};
}

export function renderSubscription(
	subscription: SubscriptionDto | null,
): BotContent {
	if (!subscription) {
		return {
			text: 'در حال حاضر در هیچ برنامه‌ای ثبت‌نام نکرده‌اید.',
			buttons: [
				[{ text: 'انتخاب برنامه', callbackData: 'menu:subscribe' }],
				[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
			],
		};
	}

	const mode =
		subscription.mode === 'FOLLOW_PROGRAM'
			? 'پیروی از دروس پیش‌فرض برنامه'
			: `انتخاب دستی ${subscription.selectedCourseOfferingIds.length} درس`;

	return {
		text: [
			'برنامه فعلی شما',
			`برنامه: ${subscription.programTitle}`,
			`ترم: ${subscription.termTitle}`,
			`حالت: ${mode}`,
		].join('\n'),
		buttons: [
			[{ text: 'ویرایش دروس', callbackData: 'menu:customize' }],
			[{ text: 'تنظیم اعلان‌ها', callbackData: 'menu:prefs' }],
			[{ text: 'لغو اشتراک', callbackData: 'menu:unsubscribe' }],
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderPreferences(subscription: SubscriptionDto): BotContent {
	const preference = subscription.preferences;
	if (!preference) {
		return {
			text: 'تنظیمات اعلان برای این برنامه یافت نشد.',
			buttons: backToMenu(),
		};
	}

	const onOff = (enabled: boolean): string => (enabled ? 'روشن' : 'خاموش');

	return {
		text: [
			'تنظیمات اعلان‌ها',
			`خلاصه روزانه: ${onOff(preference.dailySummaryEnabled)}`,
			`ساعت خلاصه روزانه: ${preference.dailySummaryTime}`,
			`یادآوری کلاس: ${onOff(preference.classReminderEnabled)}`,
			`فاصله یادآوری: ${preference.reminderOffsetMinutes} دقیقه قبل`,
			`اعلان روز بدون کلاس: ${onOff(preference.notifyOnEmptyDays)}`,
		].join('\n'),
		buttons: [
			[
				{
					text: `خلاصه روزانه: ${onOff(preference.dailySummaryEnabled)}`,
					callbackData: 'pref:toggle:summary',
				},
			],
			[
				{
					text: `یادآوری کلاس: ${onOff(preference.classReminderEnabled)}`,
					callbackData: 'pref:toggle:reminder',
				},
			],
			[
				{
					text: `اعلان روز بدون کلاس: ${onOff(preference.notifyOnEmptyDays)}`,
					callbackData: 'pref:toggle:empty',
				},
			],
			[
				{ text: '۰۷:۰۰', callbackData: 'pref:time:07:00' },
				{ text: '۰۸:۰۰', callbackData: 'pref:time:08:00' },
				{ text: '۰۹:۰۰', callbackData: 'pref:time:09:00' },
			],
			[
				{ text: '۳۰ دقیقه قبل', callbackData: 'pref:offset:30' },
				{ text: '۶۰ دقیقه قبل', callbackData: 'pref:offset:60' },
				{ text: '۱۲۰ دقیقه قبل', callbackData: 'pref:offset:120' },
			],
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderLevels(levels: ReadonlyArray<AcademicLevel>): BotContent {
	return {
		text: 'مقطع تحصیلی خود را انتخاب کنید:',
		buttons: [
			...levels
				.slice(0, 20)
				.map((level) => [{ text: level.title, callbackData: `level:${level.id}` }]),
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderFields(fields: ReadonlyArray<FieldOfStudy>): BotContent {
	return {
		text: 'رشته تحصیلی خود را انتخاب کنید:',
		buttons: [
			...fields
				.slice(0, 20)
				.map((field) => [{ text: field.title, callbackData: `field:${field.id}` }]),
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderTerms(terms: ReadonlyArray<AcademicTerm>): BotContent {
	return {
		text: 'ترم تحصیلی را انتخاب کنید:',
		buttons: [
			...terms.slice(0, 20).map((term) => [
				{
					text: `${term.title}${term.isActive ? '' : ' (غیرفعال)'}`,
					callbackData: `term:${term.id}`,
				},
			]),
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderStudyLevels(
	levels: ReadonlyArray<AcademicLevel>,
): BotContent {
	return {
		text: 'مقطع تحصیلی خود را انتخاب کنید:',
		buttons: [
			...levels.slice(0, 20).map((level) => [
				{ text: level.title, callbackData: `sf:level:${level.id}` },
			]),
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderStudyFields(
	fields: ReadonlyArray<StudyField>,
): BotContent {
	return {
		text: 'رشته تحصیلی خود را انتخاب کنید:',
		buttons: [
			...fields
				.slice(0, 20)
				.map((field) => [
					{ text: field.name, callbackData: `sf:field:${field.id}` },
				]),
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderStudyTerms(
	terms: ReadonlyArray<AcademicTerm>,
): BotContent {
	return {
		text: 'ترم تحصیلی را انتخاب کنید:',
		buttons: [
			...terms.slice(0, 20).map((term) => [
				{
					text: `${term.title}${term.isActive ? '' : ' (غیرفعال)'}`,
					callbackData: `sf:term:${term.id}`,
				},
			]),
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderCourseOfferings(
	offerings: ReadonlyArray<CourseOfferingView>,
	selectedCourseOfferingIds: ReadonlySet<string>,
): BotContent {
	const rows: OutboundButton[][] = offerings.slice(0, 30).map((view) => [
		{
			text: `${selectedCourseOfferingIds.has(view.courseOffering.id) ? '[x]' : '[ ]'} ${view.course.code} - ${view.course.title}${view.courseOffering.sectionCode ? ` (${view.courseOffering.sectionCode})` : ''}`,
			callbackData: `sf:toggle:${view.courseOffering.id}`,
		},
	]);
	rows.push([{ text: 'ذخیره انتخاب دروس', callbackData: 'sf:save' }]);
	rows.push([{ text: 'بازگشت به منو', callbackData: 'menu:home' }]);

	return {
		text: [
			'دروس مورد نظر خود را انتخاب کنید.',
			selectedCourseOfferingIds.size === 0
				? 'هیچ درسی انتخاب نشده است.'
				: `${selectedCourseOfferingIds.size} درس انتخاب شده است.`,
		].join('\n'),
		buttons: rows,
	};
}

export function renderStudentPreferences(
	selection: UserAcademicSelection,
): BotContent {
	return {
		text: [
			'تنظیمات اعلان‌های برنامه انتخابی',
			'',
			`یادآوری کلاس: ${selection.classReminderEnabled ? 'فعال' : 'غیرفعال'}`,
			`زمان یادآوری: ${selection.reminderOffsetMinutes} دقیقه قبل از کلاس`,
		].join('\n'),
		buttons: [
			[
				{
					text: selection.classReminderEnabled
						? 'غیرفعال کردن یادآوری'
						: 'فعال کردن یادآوری',
					callbackData: 'spref:toggle:reminder',
				},
			],
			[
				{ text: '۱۵ دقیقه قبل', callbackData: 'spref:offset:15' },
				{ text: '۳۰ دقیقه قبل', callbackData: 'spref:offset:30' },
			],
			[
				{ text: '۶۰ دقیقه قبل', callbackData: 'spref:offset:60' },
				{ text: '۱۲۰ دقیقه قبل', callbackData: 'spref:offset:120' },
			],
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderPrograms(
	programs: ReadonlyArray<ProgramSummaryDto>,
): BotContent {
	return {
		text: [
			'برنامه تحصیلی خود را انتخاب کنید:',
			'پس از انتخاب، دروس پیش‌فرض برنامه فعال می‌شوند.',
		].join('\n'),
		buttons: [
			...programs.slice(0, 20).map((program) => [
				{
					text: `${program.title} (${program.courseCount} درس)`,
					callbackData: `program:${program.id}`,
				},
			]),
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}

export function renderProgramCourses(
	courses: ProgramCoursesDto,
	selectedCourseOfferingIds?: ReadonlySet<string>,
): BotContent {
	const selected =
		selectedCourseOfferingIds ??
		new Set(
			courses.courses
				.filter((course) => course.selected)
				.map((course) => course.courseOfferingId),
		);

	const rows: OutboundButton[][] = courses.courses.slice(0, 30).map((course) => [
		{
			text: `${selected.has(course.courseOfferingId) ? '[x]' : '[ ]'} ${course.courseCode} - ${course.courseTitle}`,
			callbackData: `course:toggle:${course.courseOfferingId}`,
		},
	]);

	rows.push([{ text: 'ذخیره انتخاب', callbackData: 'course:save' }]);
	rows.push([
		{ text: 'بازگشت به دروس پیش‌فرض برنامه', callbackData: 'course:follow' },
	]);
	rows.push([{ text: 'بازگشت به منو', callbackData: 'menu:home' }]);

	return {
		text: [
			`انتخاب دروس برای ${courses.programTitle}`,
			'دروس مورد نظر را انتخاب یا حذف کنید، سپس ذخیره کنید.',
			selected.size === 0
				? 'هیچ درسی انتخاب نشده است.'
				: `${selected.size} درس انتخاب شده است.`,
		].join('\n'),
		buttons: rows,
	};
}

export function renderUnresolvedProgramGrouping(): BotContent {
	return {
		text: [
			'برای این مقطع، رشته و ترم برنامه تحصیلی قابل انتخاب پیدا نشد.',
			'منبع دانشگاه در پاسخ فعلی، گروه‌بندی برنامه/رشته کافی برای ساخت برنامه ارائه نکرده است.',
			'این مورد به عنوان یک نیاز یکپارچه‌سازی حل‌نشده ثبت شده و نباید با داده ساختگی پر شود.',
		].join('\n'),
		buttons: backToMenu(),
	};
}
