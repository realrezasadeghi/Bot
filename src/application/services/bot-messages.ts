import { LocalDate } from '../../domain/shared/local-date.js';
import { WEEKDAY_LABELS_FA } from '../../domain/shared/weekday.js';
import type { OutboundButton } from '../dto/messaging.js';
import type { ScheduleEntryDto } from '../dto/schedule.js';

export interface BotContent {
	text: string;
	buttons: OutboundButton[][];
}

export const MAIN_MENU: OutboundButton[][] = [
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

export function backToMenu(): OutboundButton[][] {
	return [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]];
}

export function weekdayOf(date: string): string {
	const parsed = LocalDate.tryParse(date);
	return parsed ? WEEKDAY_LABELS_FA[parsed.weekday()] : '';
}

export function formatEntry(entry: ScheduleEntryDto): string {
	const instructor = entry.instructorName ? ` | ${entry.instructorName}` : '';
	const location = entry.location ? ` | ${entry.location}` : '';
	const cancelled = entry.status === 'CANCELLED' ? ' | لغو شده' : '';
	return `${entry.startTime}-${entry.endTime} | ${entry.courseTitle} (${entry.courseCode})${instructor}${location}${cancelled}`;
}

export {
	renderFields,
	renderLevels,
	renderPrograms,
	renderStudyFields,
	renderStudyLevels,
	renderStudyTerms,
	renderTerms,
} from './academic-renderers.js';
export {
	renderCourseOfferings,
	renderProgramCourses,
} from './course-renderers.js';
export {
	renderHelp,
	renderMainMenu,
	renderUnresolvedProgramGrouping,
	renderWelcome,
} from './menu-renderers.js';
export {
	renderDailySchedule,
	renderExaminations,
	renderWeeklySchedule,
} from './schedule-renderers.js';
export {
	renderPreferences,
	renderStudentPreferences,
	renderSubscription,
} from './subscription-renderers.js';
