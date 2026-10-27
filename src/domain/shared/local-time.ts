import { normalizeDigits, normalizePersianText } from './digits.js';
import { ValidationError } from './errors.js';

export class LocalTime {
	static readonly MINUTES_PER_DAY = 24 * 60;

	private constructor(readonly minutes: number) {}

	static parse(input: string): LocalTime {
		const normalized = normalizePersianText(normalizeDigits(input))
			.replace(/[.٫]/g, ':')
			.replace(/\s+/g, '');

		const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(normalized);
		if (!match) {
			throw new ValidationError(`Invalid local time: "${input}"`);
		}

		return LocalTime.fromMinutes(Number(match[1]) * 60 + Number(match[2]));
	}

	static fromMinutes(minutes: number): LocalTime {
		if (
			!Number.isInteger(minutes) ||
			minutes < 0 ||
			minutes >= LocalTime.MINUTES_PER_DAY
		) {
			throw new ValidationError(`Local time minutes out of range: ${minutes}`);
		}
		return new LocalTime(minutes);
	}

	static tryParse(input: string): LocalTime | null {
		try {
			return LocalTime.parse(input);
		} catch {
			return null;
		}
	}

	addMinutes(minutes: number): LocalTime {
		const total = this.minutes + minutes;
		const wrapped =
			((total % LocalTime.MINUTES_PER_DAY) + LocalTime.MINUTES_PER_DAY) %
			LocalTime.MINUTES_PER_DAY;
		return LocalTime.fromMinutes(wrapped);
	}

	isBefore(other: LocalTime): boolean {
		return this.minutes < other.minutes;
	}

	isAfter(other: LocalTime): boolean {
		return this.minutes > other.minutes;
	}

	equals(other: LocalTime): boolean {
		return this.minutes === other.minutes;
	}

	toDate(baseDate: Date): Date {
		const result = new Date(baseDate);
		result.setUTCHours(Math.floor(this.minutes / 60), this.minutes % 60, 0, 0);
		return result;
	}

	toString(): string {
		const hours = Math.floor(this.minutes / 60)
			.toString()
			.padStart(2, '0');
		const minutes = (this.minutes % 60).toString().padStart(2, '0');
		return `${hours}:${minutes}`;
	}
}
