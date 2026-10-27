import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTMLUniversitySource } from '../../../src/adapters/outbound/university/html-source.js';
import type { UniversitySourceRequest } from '../../../src/application/ports/outbound/university-source.js';
import { ExternalSourceError } from '../../../src/domain/shared/errors.js';

const FIXTURE_DIR = path.join(process.cwd(), 'tests/fixtures/university');

async function loadFixture(name: string): Promise<string> {
	return readFile(path.join(FIXTURE_DIR, name), 'utf8');
}

function makeRequest(
	overrides: Partial<UniversitySourceRequest> = {},
): UniversitySourceRequest {
	return {
		sourceKey: 'test-source',
		offerUrl: 'https://portal.eqbal.ac.ir/offer',
		queryParam: 'param',
		queryR: 'r-value',
		termCode: '14051',
		viewStateGenerator: 'AF036D42',
		gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
		chkMain: true,
		requestTimeoutMs: 5000,
		xRequestedWith: 'XMLHttpRequest',
		...overrides,
	};
}

function mockFetch(
	html: string,
	status = 200,
	contentType = 'text/html; charset=utf-8',
): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				({
					ok: status >= 200 && status < 300,
					status,
					headers: new Headers({ 'content-type': contentType }),
					text: async () => html,
				}) as unknown as Response,
		),
	);
}

function mockFetchError(error: Error): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			throw error;
		}),
	);
}

function mockFetchStatus(status: number): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				({
					ok: false,
					status,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => `Error ${status}`,
				}) as unknown as Response,
		),
	);
}

beforeEach(() => {
	vi.unstubAllGlobals();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('HTMLUniversitySource', () => {
	describe('fetchSnapshot with valid HTML', () => {
		it('parses course rows into a complete snapshot', async () => {
			const html = await loadFixture('valid.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.sourceKey).toBe('test-source');
			expect(snapshot.complete).toBe(true);
			expect(snapshot.term.externalCode).toBe('14051');
			expect(snapshot.courses.length).toBeGreaterThan(0);
			expect(snapshot.instructors.length).toBeGreaterThan(0);
			expect(snapshot.levels.length).toBeGreaterThan(0);
			expect(snapshot.courseOfferings.length).toBeGreaterThan(0);
			expect(snapshot.warnings.length).toBe(0);
		});

		it('maps course table columns to DTOs correctly', async () => {
			const html = await loadFixture('valid.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.courses.length).toBeGreaterThan(0);
			const course = snapshot.courses[0];
			expect(course.title).toContain('آزمایشگاه');
			expect(course.externalKey).toMatch(/^course-/);

			expect(snapshot.instructors.length).toBeGreaterThan(0);
			const instructor = snapshot.instructors[0];
			expect(instructor.fullName).not.toContain('(حضوري)');
			expect(instructor.externalKey).toMatch(/^instructor-/);

			expect(snapshot.levels.length).toBeGreaterThan(0);
			const level = snapshot.levels[0];
			expect(level.title).toBe('كارشناسي پيوسته');
			expect(level.externalKey).toMatch(/^level-/);

			expect(snapshot.courseOfferings.length).toBeGreaterThan(0);
			const offering = snapshot.courseOfferings[0];
			expect(offering.meetingPatterns.length).toBeGreaterThan(0);
			expect(offering.meetingPatterns[0].weekday).toBeGreaterThanOrEqual(0);
			expect(offering.meetingPatterns[0].weekday).toBeLessThanOrEqual(6);
			expect(offering.meetingPatterns[0].startTime).toMatch(/^\d{2}:\d{2}$/);
			expect(offering.meetingPatterns[0].endTime).toMatch(/^\d{2}:\d{2}$/);
		});

		it('parses multiple meeting patterns from one row', async () => {
			const html = await loadFixture('valid.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			const offeringsWithPatterns = snapshot.courseOfferings.filter(
				(o) => o.meetingPatterns.length > 0,
			);
			expect(offeringsWithPatterns.length).toBeGreaterThan(0);
		});

		it('parses exam dates into schedule exceptions', async () => {
			const html = await loadFixture('valid.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			const exceptions = snapshot.scheduleExceptions;
			expect(exceptions.length).toBeGreaterThan(0);
			const firstException = exceptions[0];
			expect(firstException.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(firstException.courseOfferingExternalKey).toBeDefined();
			expect(firstException.type).toBe('TIME_CHANGED');
		});
	});

	describe('Persian and Arabic numerals', () => {
		it('normalizes Persian digits in course names and schedules', async () => {
			const html = await loadFixture('persian-numerals.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.complete).toBe(true);
			expect(snapshot.courses.length).toBe(2);

			expect(snapshot.courses[0].title).toContain('دوره تستی');
			expect(snapshot.courses[1].title).toContain('دوره با اعداد');

			const multiInstructor = snapshot.instructors.find((i) =>
				i.fullName.includes('استاد دو'),
			);
			expect(multiInstructor).toBeDefined();
		});
	});

	describe('Incomplete responses', () => {
		it('returns incomplete snapshot for empty table', async () => {
			const html = await loadFixture('empty-table.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.complete).toBe(false);
			expect(snapshot.courseOfferings.length).toBe(0);
			expect(snapshot.warnings.length).toBeGreaterThan(0);
		});

		it('returns incomplete snapshot for login page', async () => {
			const html = await loadFixture('login-page.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.complete).toBe(false);
			expect(snapshot.courseOfferings.length).toBe(0);
			expect(snapshot.warnings.some((w) => w.includes('login or error'))).toBe(
				true,
			);
		});

		it('returns incomplete snapshot for error page', async () => {
			const html = await loadFixture('error-page.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.complete).toBe(false);
			expect(snapshot.courseOfferings.length).toBe(0);
		});

		it('returns incomplete snapshot for missing headers', async () => {
			const html = await loadFixture('missing-headers.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.complete).toBe(false);
			expect(snapshot.courseOfferings.length).toBe(0);
			expect(snapshot.warnings.length).toBeGreaterThan(0);
		});

		it('returns incomplete snapshot for HTML with no table', async () => {
			const html = await loadFixture('no-table.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			expect(snapshot.complete).toBe(false);
			expect(snapshot.courseOfferings.length).toBe(0);
		});
	});

	describe('HTTP errors', () => {
		it('throws ExternalSourceError on HTTP 4xx', async () => {
			mockFetchStatus(404);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			await expect(source.fetchSnapshot(makeRequest())).rejects.toThrow(
				ExternalSourceError,
			);
		});

		it('throws ExternalSourceError on HTTP 5xx', async () => {
			mockFetchStatus(500);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			await expect(source.fetchSnapshot(makeRequest())).rejects.toThrow(
				ExternalSourceError,
			);
		});

		it('throws ExternalSourceError on network error', async () => {
			mockFetchError(new Error('DNS lookup failed'));

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			await expect(source.fetchSnapshot(makeRequest())).rejects.toThrow(
				ExternalSourceError,
			);
		});
	});

	describe('Request construction', () => {
		it('sends POST with form-urlencoded body and correct query params', async () => {
			const html = await loadFixture('valid.html');
			const fetchMock = vi.fn(
				async () =>
					({
						ok: true,
						status: 200,
						headers: new Headers({ 'content-type': 'text/html' }),
						text: async () => html,
					}) as unknown as Response,
			);
			vi.stubGlobal('fetch', fetchMock);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'custom_param',
				queryR: 'custom_r',
				termCode: '14052',
				viewStateGenerator: 'VS_GEN',
				gridInfo: 'grid_info_value',
				chkMain: false,
				requestTimeoutMs: 10000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const request = makeRequest({ termCode: '14052' });
			await source.fetchSnapshot(request);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const callArgs = fetchMock.mock.calls[0];
			expect(callArgs).toBeDefined();
			const callUrl = callArgs[0] as string;
			const url = new URL(callUrl);
			expect(url.searchParams.get('custom_param')).toBe('14052');
			expect(url.searchParams.get('r')).toBe('custom_r');

			const callOptions = callArgs[1] as RequestInit;
			expect(callOptions.method).toBe('POST');
			expect(callOptions.headers).toMatchObject({
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			});
			const body = callOptions.body as URLSearchParams;
			expect(body.get('__VIEWSTATEGENERATOR')).toBe('VS_GEN');
			expect(body.get('HiTerm')).toBe('14052');
			expect(body.get('mx_grid_info')).toBe('grid_info_value');
			expect(body.get('Chk_main')).toBe('false');
			expect(body.get('Term_Drp')).toBe('14052');
		});

		it('applies configured timeout', async () => {
			const html = await loadFixture('valid.html');
			const fetchMock = vi.fn(
				async () =>
					({
						ok: true,
						status: 200,
						headers: new Headers({ 'content-type': 'text/html' }),
						text: async () => html,
					}) as unknown as Response,
			);
			vi.stubGlobal('fetch', fetchMock);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 30000,
				xRequestedWith: 'XMLHttpRequest',
			});

			await source.fetchSnapshot(makeRequest());

			const callArgs = fetchMock.mock.calls[0];
			expect(callArgs).toBeDefined();
			const callOptions = callArgs[1] as RequestInit;
			const signal = callOptions.signal as AbortSignal;
			expect(signal).toBeInstanceOf(AbortSignal);
		});
	});

	describe('Stable identifiers', () => {
		it('produces stable external keys across repeated imports', async () => {
			const html = await loadFixture('valid.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot1 = await source.fetchSnapshot(makeRequest());
			const snapshot2 = await source.fetchSnapshot(makeRequest());

			expect(snapshot1.courses.map((c) => c.externalKey).sort()).toEqual(
				snapshot2.courses.map((c) => c.externalKey).sort(),
			);
			expect(snapshot1.instructors.map((i) => i.externalKey).sort()).toEqual(
				snapshot2.instructors.map((i) => i.externalKey).sort(),
			);
			expect(snapshot1.levels.map((l) => l.externalKey).sort()).toEqual(
				snapshot2.levels.map((l) => l.externalKey).sort(),
			);
		});

		it('does not use row numbers as course external keys', async () => {
			const html = await loadFixture('valid.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			for (const course of snapshot.courses) {
				expect(course.externalKey).toMatch(/^course-/);
				expect(course.externalKey).not.toMatch(/^course-\d+$/);
			}
		});
	});

	describe('Validation', () => {
		it('produces a snapshot that passes snapshot validation', async () => {
			const html = await loadFixture('valid.html');
			mockFetch(html);

			const source = new HTMLUniversitySource({
				sourceKey: 'test-source',
				offerUrl: 'https://portal.eqbal.ac.ir/offer',
				queryParam: 'param',
				queryR: 'r-value',
				termCode: '14051',
				viewStateGenerator: 'AF036D42',
				gridInfo: '0;1;1;1;;;onGridLoad;1;;;',
				chkMain: true,
				requestTimeoutMs: 5000,
				xRequestedWith: 'XMLHttpRequest',
			});

			const snapshot = await source.fetchSnapshot(makeRequest());

			const { validateUniversitySnapshot } = await import(
				'../../../src/application/services/snapshot-validator.js'
			);
			expect(() => validateUniversitySnapshot(snapshot)).not.toThrow();
		});
	});
});
