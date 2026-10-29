import type { CheerioAPI } from 'cheerio';
import {
	normalizeDigits,
	normalizePersianText,
} from '../../../domain/shared/digits.js';
import { LocalTime } from '../../../domain/shared/local-time.js';
import { parseWeekday, Weekday } from '../../../domain/shared/weekday.js';

export const EXPECTED_HEADERS = [
	'رديف',
	'نام درس',
	'استاد',
	'برنامه زماني',
	'زمان امتحان',
	'مقطع',
	'ترم',
	'ظرفيت مانده',
];

export const SCHEDULE_SEGMENT_SEPARATOR = ' **';
export const WEEK_PARITY_EVEN = '(هفته زوج)';
export const WEEK_PARITY_ODD = '(هفته فرد)';

export interface ColumnIndex {
	rowNumber?: number;
	courseName: number;
	instructor: number;
	schedule: number;
	exam: number;
	level: number;
	termCode: number;
	remainingCapacity: number;
}

export interface ParsedMeetingPattern {
	weekday: Weekday;
	startTime: string;
	endTime: string;
	location: string | null;
	effectiveFrom: string | null;
	effectiveTo: string | null;
}

export interface ParsedExam {
	date: string | null;
	weekday: string | null;
	startTime: string | null;
	endTime: string | null;
}

export interface ParsedRow {
	rowNumber: string | null;
	courseName: string;
	instructors: string[];
	schedulePatterns: ParsedMeetingPattern[];
	exam: ParsedExam;
	level: string | null;
	termCode: string | null;
	remainingCapacity: string | null;
}

export function slugify(input: string): string {
	return normalizePersianText(normalizeDigits(input))
		.replace(/[^\w\u0600-\u06FF\s-]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

export function tryParseWeekday(faName: string): Weekday | null {
	try {
		return parseWeekday(faName);
	} catch {
		return null;
	}
}

export const WEEKDAY_FA_TO_ENUM: ReadonlyArray<[string, Weekday]> = [
	['سه شنبه', Weekday.Tuesday],
	['سهشنبه', Weekday.Tuesday],
	['چهار شنبه', Weekday.Wednesday],
	['چهارشنبه', Weekday.Wednesday],
	['پنج شنبه', Weekday.Thursday],
	['پنجشنبه', Weekday.Thursday],
	['دوشنبه', Weekday.Monday],
	['یکشنبه', Weekday.Sunday],
	['شنبه', Weekday.Saturday],
	['جمعه', Weekday.Friday],
];

export function parseSchedule(scheduleRaw: string): {
	patterns: ParsedMeetingPattern[];
	warnings: string[];
} {
	const patterns: ParsedMeetingPattern[] = [];
	const warnings: string[] = [];

	if (!scheduleRaw || scheduleRaw.trim().length === 0) {
		return { patterns, warnings };
	}

	const segments = scheduleRaw.split(SCHEDULE_SEGMENT_SEPARATOR);

	for (const segment of segments) {
		const trimmed = segment.trim();
		if (!trimmed) continue;

		const cleaned = trimmed
			.replace(new RegExp(WEEK_PARITY_EVEN, 'g'), '')
			.replace(new RegExp(WEEK_PARITY_ODD, 'g'), '')
			.trim();

		if (!cleaned) {
			warnings.push(`Schedule segment with only week-parity marker: "${trimmed}"`);
			continue;
		}

		let weekday: Weekday | null = null;
		let rest = cleaned;
		for (const [faName] of WEEKDAY_FA_TO_ENUM) {
			if (cleaned.startsWith(faName)) {
				weekday = tryParseWeekday(faName);
				rest = cleaned.slice(faName.length).trim();
				break;
			}
		}
		if (weekday === null) {
			warnings.push(`Could not parse weekday from schedule segment: "${trimmed}"`);
			continue;
		}

		const timeMatch = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(rest);
		if (!timeMatch) {
			warnings.push(
				`Could not parse time range from schedule segment: "${trimmed}"`,
			);
			continue;
		}

		const startTime = LocalTime.fromMinutes(
			Number(timeMatch[1]) * 60 + Number(timeMatch[2]),
		);
		const endTime = LocalTime.fromMinutes(
			Number(timeMatch[3]) * 60 + Number(timeMatch[4]),
		);

		const afterTime = rest.slice(timeMatch[0].length).trim();
		const locationRaw = afterTime.replace(/^-\s*/, '').trim();
		const location = locationRaw.length > 0 ? locationRaw : null;

		patterns.push({
			weekday,
			startTime: startTime.toString(),
			endTime: endTime.toString(),
			location,
			effectiveFrom: null,
			effectiveTo: null,
		});
	}

	return { patterns, warnings };
}

export function parseInstructors(instructorRaw: string): string[] {
	if (!instructorRaw || instructorRaw.trim().length === 0) return [];

	const normalized = normalizePersianText(normalizeDigits(instructorRaw));
	const parts = normalized.split(/\s*-\s*/);
	return parts
		.map((part) => part.replace(/\s*\(حضوري\)\s*$/, '').trim())
		.filter((part) => part.length > 0);
}

export function parseExam(examRaw: string): ParsedExam {
	if (!examRaw || examRaw.trim().length === 0) {
		return { date: null, weekday: null, startTime: null, endTime: null };
	}

	const cleaned = normalizePersianText(normalizeDigits(examRaw)).trim();

	const dateMatch = /(\d{4})[/](\d{1,2})[/](\d{1,2})/.exec(cleaned);
	const date = dateMatch
		? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`
		: null;

	let examWeekday: string | null = null;
	let examStartTime: string | null = null;
	let examEndTime: string | null = null;

	const timeMatch = /(\d{1,2}):(\d{2})\s*تا\s*(\d{1,2}):(\d{2})/.exec(cleaned);
	if (timeMatch) {
		examStartTime = `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}`;
		examEndTime = `${String(timeMatch[3]).padStart(2, '0')}:${timeMatch[4]}`;
	}

	const afterDate = cleaned
		.replace(/پايان ترم\s*/, '')
		.replace(dateMatch?.[0] ?? '', '')
		.replace(/-/g, ' ')
		.replace(/از.*/, '')
		.trim();
	if (afterDate) {
		const candidateWeekday = afterDate.split(/\s+/)[0] ?? '';
		if (candidateWeekday && tryParseWeekday(candidateWeekday) !== null) {
			examWeekday = candidateWeekday;
		}
	}

	return {
		date,
		weekday: examWeekday,
		startTime: examStartTime,
		endTime: examEndTime,
	};
}

export function detectColumnIndices($: CheerioAPI): ColumnIndex | null {
	let bestHeaders: string[] | null = null;
	let bestMatchCount = 0;

	$('table').each((_index, tableEl) => {
		const $table = $(tableEl);
		const headerRow = $table.find('tr').first();
		if (headerRow.length === 0) return;

		const headers = headerRow
			.find('th, td')
			.map((_thIndex, th) =>
				normalizePersianText(normalizeDigits($(th).text())).trim(),
			)
			.get();

		let matchCount = 0;
		for (const expected of EXPECTED_HEADERS) {
			const normalizedExpected = normalizePersianText(
				normalizeDigits(expected),
			).trim();
			if (headers.some((h) => h === normalizedExpected)) {
				matchCount += 1;
			}
		}

		if (matchCount > bestMatchCount && matchCount >= 6) {
			bestMatchCount = matchCount;
			bestHeaders = headers;
		}
	});

	if (!bestHeaders) return null;

	const headers: string[] = bestHeaders as string[];

	const findHeader = (name: string): number | undefined => {
		const normalized = normalizePersianText(normalizeDigits(name)).trim();
		const index = headers.indexOf(normalized);
		return index === -1 ? undefined : index;
	};

	const courseNameIdx = findHeader('نام درس');
	const instructorIdx = findHeader('استاد');
	const scheduleIdx = findHeader('برنامه زماني');
	const examIdx = findHeader('زمان امتحان');
	const levelIdx = findHeader('مقطع');
	const termCodeIdx = findHeader('ترم');
	const remainingCapacityIdx = findHeader('ظرفيت مانده');

	if (
		courseNameIdx === undefined ||
		instructorIdx === undefined ||
		scheduleIdx === undefined ||
		examIdx === undefined ||
		levelIdx === undefined ||
		termCodeIdx === undefined ||
		remainingCapacityIdx === undefined
	) {
		return null;
	}

	return {
		courseName: courseNameIdx,
		instructor: instructorIdx,
		schedule: scheduleIdx,
		exam: examIdx,
		level: levelIdx,
		termCode: termCodeIdx,
		remainingCapacity: remainingCapacityIdx,
	};
}

export function parseRow(
	$: CheerioAPI,
	// biome-ignore lint/suspicious/noExplicitAny: cheerio does not export its element type
	el: any,
	columns: ColumnIndex,
): ParsedRow | null {
	const $row = $(el);
	const tds = $row.find('td');

	const getCellText = (index: number): string => {
		const cell = tds[index];
		return cell ? $(cell).text().trim() : '';
	};

	const rowNumber = getCellText(0) || null;
	const courseName = getCellText(columns.courseName);
	if (!courseName) return null;

	const instructorRaw = getCellText(columns.instructor);
	const scheduleRaw = getCellText(columns.schedule);
	const examRaw = getCellText(columns.exam);
	const level = getCellText(columns.level) || null;
	const termCode = getCellText(columns.termCode) || null;
	const remainingCapacity = getCellText(columns.remainingCapacity) || null;

	const instructors = parseInstructors(instructorRaw);
	const { patterns: schedulePatterns } = parseSchedule(scheduleRaw);
	const exam = parseExam(examRaw);

	return {
		rowNumber,
		courseName,
		instructors,
		schedulePatterns,
		exam,
		level,
		termCode,
		remainingCapacity,
	};
}

export function isLikelyErrorOrLoginPage($: CheerioAPI): boolean {
	const title = normalizePersianText(
		normalizeDigits($('title').first().text()),
	).toLowerCase();
	const bodyText = normalizePersianText(
		normalizeDigits($('body').text()),
	).toLowerCase();

	const suspiciousTitles = [
		'login',
		'ورود',
		'خطا',
		'error',
		'unauthorized',
		'دسترسی',
		'ممنوع',
		'forbidden',
		'not found',
		'يافت نشد',
	];
	for (const suspicious of suspiciousTitles) {
		if (title.includes(suspicious)) return true;
	}

	const hasPasswordInput = $('input[type="password"]').length > 0;
	const hasViewState = $('input[name="__VIEWSTATE"]').length > 0;
	const hasLoginButton =
		$('input[type="submit"], button[type="submit"]').filter((_btnIndex, btn) => {
			const text = $(btn).text().toLowerCase();
			return (
				text.includes('ورود') || text.includes('login') || text.includes('submit')
			);
		}).length > 0;

	if (hasPasswordInput && (hasViewState || hasLoginButton)) return true;

	const tables = $('table');
	if (tables.length === 0 && bodyText.length < 500) {
		const suspiciousBody = ['خطا', 'error', 'دسترسی', 'unauthorized', 'ممنوع'];
		if (suspiciousBody.some((s) => bodyText.includes(s))) return true;
	}

	return false;
}
