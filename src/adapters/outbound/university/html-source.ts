import { type CheerioAPI, load } from 'cheerio';
import type {
	UniversityAcademicSnapshot,
	UniversityCourseDto,
	UniversityCourseOfferingDto,
	UniversityFieldDto,
	UniversityInstructorDto,
	UniversityLevelDto,
	UniversityProgramDto,
	UniversityProgramOfferingDto,
	UniversityExaminationDto,
	UniversityScheduleExceptionDto,
	UniversityTermDto,
} from '../../../application/dto/university.js';
import type {
	UniversityAcademicSource,
	UniversitySourceRequest,
} from '../../../application/ports/outbound/university-source.js';
import {
	normalizeDigits,
	normalizePersianText,
} from '../../../domain/shared/digits.js';
import { ExternalSourceError } from '../../../domain/shared/errors.js';
import { LocalTime } from '../../../domain/shared/local-time.js';
import { parseWeekday, Weekday } from '../../../domain/shared/weekday.js';

const EXPECTED_HEADERS = [
	'رديف',
	'نام درس',
	'استاد',
	'برنامه زماني',
	'زمان امتحان',
	'مقطع',
	'ترم',
	'ظرفيت مانده',
];

const SCHEDULE_SEGMENT_SEPARATOR = ' **';
const WEEK_PARITY_EVEN = '(هفته زوج)';
const WEEK_PARITY_ODD = '(هفته فرد)';

interface ColumnIndex {
	rowNumber?: number;
	courseName: number;
	instructor: number;
	schedule: number;
	exam: number;
	level: number;
	termCode: number;
	remainingCapacity: number;
}

interface ParsedMeetingPattern {
	weekday: Weekday;
	startTime: string;
	endTime: string;
	location: string | null;
	effectiveFrom: string | null;
	effectiveTo: string | null;
}

interface ParsedExam {
	date: string | null;
	weekday: string | null;
	startTime: string | null;
	endTime: string | null;
}

interface ParsedRow {
	rowNumber: string | null;
	courseName: string;
	instructors: string[];
	schedulePatterns: ParsedMeetingPattern[];
	exam: ParsedExam;
	level: string | null;
	termCode: string | null;
	remainingCapacity: string | null;
}

function slugify(input: string): string {
	return normalizePersianText(normalizeDigits(input))
		.replace(/[^\w\u0600-\u06FF\s-]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

function tryParseWeekday(faName: string): Weekday | null {
	try {
		return parseWeekday(faName);
	} catch {
		return null;
	}
}

function parseSchedule(scheduleRaw: string): {
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

// Weekday names used for matching schedule segments, ordered so longer/more
// specific names are checked first (e.g. "سه شنبه" before "سهشنبه").
const WEEKDAY_FA_TO_ENUM: ReadonlyArray<[string, Weekday]> = [
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

function parseInstructors(instructorRaw: string): string[] {
	if (!instructorRaw || instructorRaw.trim().length === 0) return [];

	const normalized = normalizePersianText(normalizeDigits(instructorRaw));
	const parts = normalized.split(/\s*-\s*/);
	return parts
		.map((part) => part.replace(/\s*\(حضوري\)\s*$/, '').trim())
		.filter((part) => part.length > 0);
}

function parseExam(examRaw: string): ParsedExam {
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

function detectColumnIndices($: CheerioAPI): ColumnIndex | null {
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

function parseRow(
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

function isLikelyErrorOrLoginPage($: CheerioAPI): boolean {
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

export class HTMLUniversitySource implements UniversityAcademicSource {
	private readonly sourceKey: string;
	private readonly offerUrl: string;
	private readonly queryParam: string;
	private readonly queryR: string;
	private readonly termCode: string;
	private readonly viewStateGenerator: string;
	private readonly gridInfo: string;
	private readonly chkMain: boolean;
	private readonly requestTimeoutMs: number;
	private readonly cookie: string | undefined;

	constructor(config: {
		sourceKey: string;
		offerUrl: string;
		queryParam: string;
		queryR: string;
		termCode: string;
		viewStateGenerator: string;
		gridInfo: string;
		chkMain: boolean;
		requestTimeoutMs: number;
		cookie?: string;
	}) {
		this.sourceKey = config.sourceKey;
		this.offerUrl = config.offerUrl;
		this.queryParam = config.queryParam;
		this.queryR = config.queryR;
		this.termCode = config.termCode;
		this.viewStateGenerator = config.viewStateGenerator;
		this.gridInfo = config.gridInfo;
		this.chkMain = config.chkMain;
		this.requestTimeoutMs = config.requestTimeoutMs;
		this.cookie = config.cookie;
	}

	async fetchSnapshot(
		request: UniversitySourceRequest,
	): Promise<UniversityAcademicSnapshot> {
		const html = await this.getHtmlResponse(request);
		return this.parseHtml(html, request);
	}

	async getHtmlResponse(request: UniversitySourceRequest): Promise<string> {
		const url = new URL(request.offerUrl || this.offerUrl);

		url.searchParams.set(this.queryParam, request.termCode || this.termCode);
		url.searchParams.set('r', this.queryR);

		const body = new URLSearchParams({
			__VIEWSTATEGENERATOR: this.viewStateGenerator,
			HiTerm: request.termCode || this.termCode,
			Name: '',
			Chk_main: String(this.chkMain),
			mx_grid_info: this.gridInfo,
			Term_Drp: request.termCode || this.termCode,
		});

		let response: Response;
		try {
			const headers: Record<string, string> = {
				accept: 'text/html,application/xhtml+xml',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'user-agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
			};

			if (this.cookie) headers.cookie = this.cookie;

			response = await fetch(url, {
				signal: AbortSignal.timeout(this.requestTimeoutMs),
				method: 'POST',
				body,
				headers,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new ExternalSourceError(`University request failed: ${message}`, true);
		}

		if (!response.ok) {
			throw new ExternalSourceError(
				`University endpoint returned HTTP ${response.status}`,
				response.status >= 500,
			);
		}

		const contentType = response.headers.get('content-type') ?? '';
		if (
			!contentType.includes('text/html') &&
			!contentType.includes('application/xhtml')
		) {
			throw new ExternalSourceError(
				`University endpoint returned unexpected content type: ${contentType}`,
				false,
			);
		}

		const html = await response.text();

		if (!html || html.trim().length === 0) {
			throw new ExternalSourceError(
				'University endpoint returned an empty response',
				true,
			);
		}

		return html;
	}

	private parseHtml(
		html: string,
		request: UniversitySourceRequest,
	): UniversityAcademicSnapshot {
		const $ = load(html);
		const warnings: string[] = [];

		if (isLikelyErrorOrLoginPage($)) {
			warnings.push('University response appears to be a login or error page');
			return this.buildIncompleteSnapshot(request, warnings);
		}

		const columns = detectColumnIndices($);
		if (!columns) {
			warnings.push('No course table found in university HTML response');
			return this.buildIncompleteSnapshot(request, warnings);
		}

		const rows: ParsedRow[] = [];
		let unparsedRowCount = 0;

		$('tr').each((_index, el) => {
			if (_index === 0) return;

			const parsed = parseRow($, el, columns);
			if (parsed) {
				rows.push(parsed);
			} else {
				unparsedRowCount += 1;
			}
		});

		if (rows.length === 0) {
			warnings.push(
				unparsedRowCount > 0
					? `Found ${unparsedRowCount} table row(s) but none could be parsed`
					: 'No course rows found in university HTML',
			);
			return this.buildIncompleteSnapshot(request, warnings);
		}

		if (unparsedRowCount > 0) {
			warnings.push(
				`${unparsedRowCount} table row(s) could not be parsed and were skipped`,
			);
		}

		// --- Derive unique entities ------------------------------------------

		const levelSet = new Set<string>();
		for (const row of rows) {
			if (row.level) levelSet.add(row.level);
		}
		const levels = Array.from(levelSet);
		const levelEntities: UniversityLevelDto[] = levels.map((levelTitle) => ({
			externalKey: `level-${slugify(levelTitle)}`,
			code: slugify(levelTitle),
			title: levelTitle,
		}));
		const levelByTitle = new Map(levelEntities.map((l) => [l.title, l]));

		const termSet = new Set<string>();
		for (const row of rows) {
			if (row.termCode) termSet.add(row.termCode);
		}
		const terms = Array.from(termSet);
		const resolvedTermCode = request.termCode || terms[0] || this.termCode;
		const term: UniversityTermDto = {
			externalCode: resolvedTermCode,
			title: `Term ${resolvedTermCode}`,
			startsOn: null,
			endsOn: null,
			isActive: true,
		};

		const fieldEntities: UniversityFieldDto[] = [];
		const programEntities: UniversityProgramDto[] = [];
		for (const level of levelEntities) {
			const fieldKey = `field-${level.externalKey}`;
			fieldEntities.push({
				externalKey: fieldKey,
				levelExternalKey: level.externalKey,
				code: level.code,
				title: level.title,
			});
			programEntities.push({
				externalKey: `program-${level.externalKey}`,
				levelExternalKey: level.externalKey,
				fieldExternalKey: fieldKey,
				code: level.code,
				title: level.title,
			});
		}
		const programByLevel = new Map(
			programEntities.map((p) => [p.levelExternalKey, p]),
		);

		const programOfferingEntities: UniversityProgramOfferingDto[] = terms.flatMap(
			(termCode) => {
				const offering: UniversityProgramOfferingDto[] = [];
				for (const program of programEntities) {
					offering.push({
						externalKey: `po-${program.externalKey}-${termCode}`,
						programExternalKey: program.externalKey,
						termExternalCode: termCode,
						title: `${program.title} ${termCode}`,
					});
				}
				return offering;
			},
		);
		const poByProgramAndTerm = new Map(
			programOfferingEntities.map((po) => [
				`${po.programExternalKey}|${po.termExternalCode}`,
				po,
			]),
		);

		const courseEntities: UniversityCourseDto[] = [];
		const courseByName = new Map<string, UniversityCourseDto>();
		for (const row of rows) {
			if (courseByName.has(row.courseName)) continue;
			const externalKey = `course-${slugify(row.courseName)}`;
			const course: UniversityCourseDto = {
				externalKey,
				code: externalKey,
				title: row.courseName,
				units: null,
			};
			courseEntities.push(course);
			courseByName.set(row.courseName, course);
		}

		const instructorEntities: UniversityInstructorDto[] = [];
		const instructorByName = new Map<string, UniversityInstructorDto>();
		for (const row of rows) {
			for (const name of row.instructors) {
				if (instructorByName.has(name)) continue;
				const externalKey = `instructor-${slugify(name)}`;
				const instructor: UniversityInstructorDto = {
					externalKey,
					fullName: name,
				};
				instructorEntities.push(instructor);
				instructorByName.set(name, instructor);
			}
		}

		const courseOfferings: UniversityCourseOfferingDto[] = [];
		const scheduleExceptions: UniversityScheduleExceptionDto[] = [];
		const examinations: UniversityExaminationDto[] = [];

		for (const row of rows) {
			const course = courseByName.get(row.courseName);
			if (!course) {
				warnings.push(`Course not found: ${row.courseName}`);
				continue;
			}

			const level = row.level ? levelByTitle.get(row.level) : undefined;
			const program = level ? programByLevel.get(level.externalKey) : undefined;
			const programOffering = program
				? poByProgramAndTerm.get(
						`${program.externalKey}|${row.termCode ?? resolvedTermCode}`,
					)
				: undefined;

			const instructorExternalKeys = row.instructors
				.map((name) => instructorByName.get(name)?.externalKey ?? '')
				.filter(Boolean);

			const sectionCode = row.remainingCapacity ?? null;

			const offering: UniversityCourseOfferingDto = {
				externalKey: `co-${course.externalKey}-${row.termCode ?? resolvedTermCode}-${slugify(row.courseName)}-${courseOfferings.length + 1}`,
				courseExternalKey: course.externalKey,
				termExternalCode: row.termCode ?? resolvedTermCode,
				programOfferingExternalKey: programOffering?.externalKey ?? null,
				sectionCode,
				instructorExternalKeys,
				location: null,
				meetingPatterns: row.schedulePatterns.map((pattern) => ({
					weekday: pattern.weekday,
					startTime: pattern.startTime,
					endTime: pattern.endTime,
					location: pattern.location,
					effectiveFrom: pattern.effectiveFrom,
					effectiveTo: pattern.effectiveTo,
				})),
			};
			courseOfferings.push(offering);

			if (row.exam.date) {
				const sourceIdentifier = `exam-${offering.externalKey}`;
				examinations.push({
					externalKey: sourceIdentifier,
					courseOfferingExternalKey: offering.externalKey,
					examDate: row.exam.date,
					startTime: row.exam.startTime ?? null,
					endTime: row.exam.endTime ?? null,
					location: null,
					sourceIdentifier,
				});
			}
		}

		const complete = unparsedRowCount === 0 && courseOfferings.length > 0;

		return {
			sourceKey: request.sourceKey || this.sourceKey,
			fetchedAt: new Date(),
			complete,
			term,
			levels: levelEntities,
			fields: fieldEntities,
			programs: programEntities,
			programOfferings: programOfferingEntities,
			courses: courseEntities,
			instructors: instructorEntities,
			courseOfferings,
			scheduleExceptions,
			examinations,
			warnings,
		};
	}

	private buildIncompleteSnapshot(
		request: UniversitySourceRequest,
		warnings: string[],
	): UniversityAcademicSnapshot {
		return {
			sourceKey: request.sourceKey || this.sourceKey,
			fetchedAt: new Date(),
			complete: false,
			term: {
				externalCode: request.termCode ?? this.termCode,
				title: `Term ${request.termCode ?? this.termCode}`,
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
			warnings,
		};
	}
}
