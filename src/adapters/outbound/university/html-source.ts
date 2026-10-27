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
} from '../../../application/dto/university.js';
import type {
	UniversityAcademicSource,
	UniversitySourceRequest,
} from '../../../application/ports/outbound/university-source.js';
import {
	normalizeDigits,
	normalizePersianText,
} from '../../../domain/shared/digits.js';
import {
	ExternalSourceError,
	ValidationError,
} from '../../../domain/shared/errors.js';
import { LocalTime } from '../../../domain/shared/local-time.js';
import { Weekday } from '../../../domain/shared/weekday.js';

const WEEKDAY_FA_TO_ENUM: ReadonlyMap<string, Weekday> = new Map([
	['شنبه', Weekday.Saturday],
	['یکشنبه', Weekday.Sunday],
	['دوشنبه', Weekday.Monday],
	['سه شنبه', Weekday.Tuesday],
	['سهشنبه', Weekday.Tuesday],
	['چهارشنبه', Weekday.Wednesday],
	['چهار شنبه', Weekday.Wednesday],
	['پنج شنبه', Weekday.Thursday],
	['پنجشنبه', Weekday.Thursday],
	['جمعه', Weekday.Friday],
]);

function slugify(input: string): string {
	return normalizePersianText(normalizeDigits(input))
		.replace(/[^\w\u0600-\u06FF\s-]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

interface ParsedMeetingPattern {
	weekday: Weekday;
	startTime: string;
	endTime: string;
	location: string | null;
	effectiveFrom: string | null;
	effectiveTo: string | null;
}

function parseSchedule(scheduleRaw: string): ParsedMeetingPattern[] {
	const patterns: ParsedMeetingPattern[] = [];

	// Multiple schedule patterns are separated by " **"
	const segments = scheduleRaw.split(' **').filter((s) => s.trim().length > 0);

	for (const segment of segments) {
		const trimmed = segment.trim();
		if (!trimmed) continue;

		// Strip week parity markers (effective dates cannot be computed without term bounds)
		const cleaned = trimmed
			.replace(/\(هفته\s*زوج\)/, '')
			.replace(/\(هفته\s*فرد\)/, '')
			.trim();

		// Identify the weekday at the start of the segment
		let weekday: Weekday | null = null;
		let rest = cleaned;
		for (const [faName, dayEnum] of WEEKDAY_FA_TO_ENUM) {
			if (cleaned.startsWith(faName)) {
				weekday = dayEnum;
				rest = cleaned.slice(faName.length).trim();
				break;
			}
		}
		if (weekday === null) continue;

		// Extract the time range: HH:MM - HH:MM
		const timeMatch = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(rest);
		if (!timeMatch) continue;

		const startTime = LocalTime.fromMinutes(
			Number(timeMatch[1]) * 60 + Number(timeMatch[2]),
		);
		const endTime = LocalTime.fromMinutes(
			Number(timeMatch[3]) * 60 + Number(timeMatch[4]),
		);

		// Everything after the time range is the location (strip leading dash)
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

	return patterns;
}

function parseInstructors(instructorRaw: string): string[] {
	// Instructors may be separated by " - " and may carry a " (حضوري)" suffix
	const normalized = normalizePersianText(normalizeDigits(instructorRaw));
	const parts = normalized.split(/\s*-\s*/);
	return parts
		.map((part) => part.replace(/\s*\(حضوري\)\s*$/, '').trim())
		.filter((part) => part.length > 0);
}

interface ParsedRow {
	courseName: string;
	instructors: string[];
	scheduleRaw: string;
	meetingPatterns: ParsedMeetingPattern[];
	level: string;
	termCode: string;
	remainingCapacity: string;
}

// biome-ignore lint/suspicious/noExplicitAny: cheerio does not export its element type
function parseRow($: CheerioAPI, el: any): ParsedRow | null {
	const $row = $(el);
	const tds = $row.find('td');
	if (tds.length < 8) return null;

	const courseName = $(tds[1]).text().trim();
	const instructorRaw = $(tds[2]).text().trim();
	const scheduleRaw = $(tds[3]).text().trim();
	const level = $(tds[5]).text().trim();
	const termCode = $(tds[6]).text().trim();
	const remainingCapacity = $(tds[7]).text().trim();

	if (!courseName) return null;

	const instructors = parseInstructors(instructorRaw);
	const meetingPatterns = parseSchedule(scheduleRaw);

	return {
		courseName,
		instructors,
		scheduleRaw,
		meetingPatterns,
		level,
		termCode,
		remainingCapacity,
	};
}

export class HTMLUniversitySource implements UniversityAcademicSource {
	async fetchSnapshot(
		request: UniversitySourceRequest,
	): Promise<UniversityAcademicSnapshot> {
		const html = await this.getHtmlResponse(request);
		return this.parseHtml(html, request);
	}

	async getHtmlResponse(request: UniversitySourceRequest) {
		const url = new URL(request.offerUrl);

		if (!request.queryParam) {
			throw new ValidationError('Query param in HTMLUniversitySource is required');
		}

		if (!request.queryR) {
			throw new ValidationError('Query r in HTMLUniversitySource is required');
		}

		url.searchParams.set('param', request.queryParam);
		url.searchParams.set('r', request.queryR);

		const raw = new URLSearchParams({
			__VIEWSTATEGENERATOR: request.viewStateGenerator,
			HiTerm: request.termCode,
			Name: '',
			Chk_main: String(request.chkMain),
			mx_grid_info: request.gridInfo,
			Term_Drp: request.termCode,
		});

		const response = await fetch(url, {
			signal: AbortSignal.timeout(request.requestTimeoutMs),
			body: raw,
			headers: {
				accept: 'text/html,application/xhtml+xml',
				'user-agent': 'academic-scheduling-bot/0.1 (inspection)',
			},
		});

		if (!response.ok) {
			throw new ExternalSourceError('Error in fetch university response', false);
		}

		return response.text();
	}

	private parseHtml(
		html: string,
		request: UniversitySourceRequest,
	): UniversityAcademicSnapshot {
		const $ = load(html);
		const warnings: string[] = [];

		const rows: ParsedRow[] = [];
		$('table.mxgrid > tr').each((_, el) => {
			const parsed = parseRow($, el);
			if (parsed) rows.push(parsed);
		});

		if (rows.length === 0) {
			warnings.push('No course rows found in university HTML');
			return {
				sourceKey: request.sourceKey,
				fetchedAt: new Date(),
				complete: false,
				term: {
					externalCode: request.termCode,
					title: `Term ${request.termCode}`,
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
				warnings,
			};
		}

		// --- Derive unique entities ------------------------------------------

		const levels = Array.from(new Set(rows.map((row) => row.level))).filter(
			Boolean,
		);
		const levelEntities: UniversityLevelDto[] = levels.map((levelTitle) => ({
			externalKey: `level-${slugify(levelTitle)}`,
			code: slugify(levelTitle),
			title: levelTitle,
		}));
		const levelByTitle = new Map(levelEntities.map((l) => [l.title, l]));

		const terms = Array.from(new Set(rows.map((row) => row.termCode))).filter(
			Boolean,
		);
		const defaultTerm = (request.termCode || terms[0]) ?? '';
		const term = {
			externalCode: defaultTerm,
			title: `Term ${defaultTerm}`,
			startsOn: null,
			endsOn: null,
			isActive: true,
		};

		// One synthetic field and program per level (HTML has no finer hierarchy)
		const fieldEntities: UniversityFieldDto[] = levelEntities.map((level) => ({
			externalKey: `field-${level.externalKey}`,
			levelExternalKey: level.externalKey,
			code: level.code,
			title: level.title,
		}));
		const programEntities: UniversityProgramDto[] = levelEntities.map(
			(level) => ({
				externalKey: `program-${level.externalKey}`,
				levelExternalKey: level.externalKey,
				fieldExternalKey: level.externalKey,
				code: level.code,
				title: level.title,
			}),
		);
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

		// Unique courses by name
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

		// Unique instructors
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

		// --- Build course offerings ------------------------------------------

		const courseOfferings: UniversityCourseOfferingDto[] = [];
		for (const row of rows) {
			const course = courseByName.get(row.courseName);
			if (!course) {
				warnings.push(`Course not found: ${row.courseName}`);
				continue;
			}

			const level = levelByTitle.get(row.level);
			const program = level ? programByLevel.get(level.externalKey) : undefined;
			const programOffering = program
				? poByProgramAndTerm.get(`${program.externalKey}|${row.termCode}`)
				: undefined;

			const instructorExternalKeys = row.instructors
				.map((name) => instructorByName.get(name)?.externalKey ?? '')
				.filter(Boolean);

			const sectionCode = row.remainingCapacity || null;

			courseOfferings.push({
				externalKey: `co-${course.externalKey}-${row.termCode}-${courseOfferings.length + 1}`,
				courseExternalKey: course.externalKey,
				termExternalCode: row.termCode,
				programOfferingExternalKey: programOffering?.externalKey ?? null,
				sectionCode,
				instructorExternalKeys,
				location: null,
				meetingPatterns: row.meetingPatterns.map((pattern, _index) => ({
					weekday: pattern.weekday,
					startTime: pattern.startTime,
					endTime: pattern.endTime,
					location: pattern.location,
					effectiveFrom: pattern.effectiveFrom,
					effectiveTo: pattern.effectiveTo,
				})),
			});
		}

		const complete = rows.length > 0 && courseOfferings.length > 0;

		return {
			sourceKey: request.sourceKey,
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
			scheduleExceptions: [],
			warnings,
		};
	}
}
