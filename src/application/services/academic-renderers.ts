import type {
	AcademicLevel,
	AcademicTerm,
	FieldOfStudy,
} from '../../domain/academic/entities.js';
import type { StudyField } from '../../domain/academic/study-field.js';
import type { ProgramSummaryDto } from '../dto/schedule.js';
import type { BotContent } from './bot-messages.js';

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
			...levels
				.slice(0, 20)
				.map((level) => [
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
