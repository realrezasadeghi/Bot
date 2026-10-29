import type { OutboundButton } from '../dto/messaging.js';
import type { CourseOfferingView } from '../dto/read-models.js';
import type { ProgramCoursesDto } from '../use-cases/subscriptions/get-subscription.js';
import type { BotContent } from './bot-content.js';

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
