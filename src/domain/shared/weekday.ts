import { normalizeForMatching } from './digits.js';
import { ValidationError } from './errors.js';

/**
 * Academic weekdays are modelled independently from JavaScript's Date.getDay().
 * 0 = Saturday (start of the Iranian academic week), 6 = Friday.
 */
export enum Weekday {
	Saturday = 0,
	Sunday = 1,
	Monday = 2,
	Tuesday = 3,
	Wednesday = 4,
	Thursday = 5,
	Friday = 6,
}

export const WEEKDAY_LABELS_FA: Readonly<Record<Weekday, string>> = {
	[Weekday.Saturday]: 'شنبه',
	[Weekday.Sunday]: 'یکشنبه',
	[Weekday.Monday]: 'دوشنبه',
	[Weekday.Tuesday]: 'سه‌شنبه',
	[Weekday.Wednesday]: 'چهارشنبه',
	[Weekday.Thursday]: 'پنجشنبه',
	[Weekday.Friday]: 'جمعه',
};

export const WEEKDAY_LABELS_EN: Readonly<Record<Weekday, string>> = {
	[Weekday.Saturday]: 'Saturday',
	[Weekday.Sunday]: 'Sunday',
	[Weekday.Monday]: 'Monday',
	[Weekday.Tuesday]: 'Tuesday',
	[Weekday.Wednesday]: 'Wednesday',
	[Weekday.Thursday]: 'Thursday',
	[Weekday.Friday]: 'Friday',
};

const WEEKDAY_ALIASES: ReadonlyMap<string, Weekday> = new Map(
	(
		[
			['شنبه', Weekday.Saturday],
			['یکشنبه', Weekday.Sunday],
			['يكشنبه', Weekday.Sunday],
			['دوشنبه', Weekday.Monday],
			['دو شنبه', Weekday.Monday],
			['سه شنبه', Weekday.Tuesday],
			['سهشنبه', Weekday.Tuesday],
			['چهارشنبه', Weekday.Wednesday],
			['چهار شنبه', Weekday.Wednesday],
			['پنجشنبه', Weekday.Thursday],
			['پنج شنبه', Weekday.Thursday],
			['جمعه', Weekday.Friday],
			['السبت', Weekday.Saturday],
			['الاحد', Weekday.Sunday],
			['الأحد', Weekday.Sunday],
			['الاثنین', Weekday.Monday],
			['الإثنين', Weekday.Monday],
			['الثلاثاء', Weekday.Tuesday],
			['الاربعاء', Weekday.Wednesday],
			['الأربعاء', Weekday.Wednesday],
			['الخمیس', Weekday.Thursday],
			['الخميس', Weekday.Thursday],
			['الجمعه', Weekday.Friday],
			['الجمعة', Weekday.Friday],
			['saturday', Weekday.Saturday],
			['sat', Weekday.Saturday],
			['sunday', Weekday.Sunday],
			['sun', Weekday.Sunday],
			['monday', Weekday.Monday],
			['mon', Weekday.Monday],
			['tuesday', Weekday.Tuesday],
			['tue', Weekday.Tuesday],
			['wednesday', Weekday.Wednesday],
			['wed', Weekday.Wednesday],
			['thursday', Weekday.Thursday],
			['thu', Weekday.Thursday],
			['friday', Weekday.Friday],
			['fri', Weekday.Friday],
		] as const
	).map(([alias, weekday]) => [normalizeForMatching(alias), weekday]),
);

export function parseWeekday(input: string): Weekday {
	const normalized = normalizeForMatching(input);
	const direct = WEEKDAY_ALIASES.get(normalized);
	if (direct !== undefined) return direct;

	for (const [alias, weekday] of WEEKDAY_ALIASES) {
		if (normalized.includes(alias)) return weekday;
	}

	throw new ValidationError(`Unknown weekday: "${input}"`);
}

export function weekdayFromUtcDate(date: Date): Weekday {
	const jsDay = date.getUTCDay();
	const map: Readonly<Record<number, Weekday>> = {
		0: Weekday.Sunday,
		1: Weekday.Monday,
		2: Weekday.Tuesday,
		3: Weekday.Wednesday,
		4: Weekday.Thursday,
		5: Weekday.Friday,
		6: Weekday.Saturday,
	};
	const weekday = map[jsDay];
	if (weekday === undefined)
		throw new Error('unreachable: UTC day out of range');
	return weekday;
}

export function isWeekday(value: number): value is Weekday {
	return Number.isInteger(value) && value >= 0 && value <= 6;
}
