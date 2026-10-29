import type { ExaminationEntryDto } from '../dto/read-models.js';
import type { DailyScheduleDto, WeeklyScheduleDto } from '../dto/schedule.js';
import type { BotContent } from './bot-messages.js';
import { formatEntry, MAIN_MENU, weekdayOf } from './bot-messages.js';
import { truncateMessage } from './notification-content.js';

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
					const location = examination.location ? ` | ${examination.location}` : '';
					return `- ${examination.examDate} | ${examination.courseTitle} (${examination.courseCode})${time}${location}`;
				}),
			].join('\n'),
		),
		buttons: MAIN_MENU,
	};
}
