import { ValidationError } from "./errors.js";
import { normalizeDigits, normalizePersianText } from "./digits.js";
import type { LocalTime } from "./local-time.js";
import type { Weekday} from "./weekday.js";
import { weekdayFromUtcDate } from "./weekday.js";
import { localDateStringInZone, zonedDateTimeToUtc } from "./time-zone.js";

const MS_PER_DAY = 86_400_000;

export class LocalDate {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {}

  static parse(input: string): LocalDate {
    const normalized = normalizePersianText(normalizeDigits(input));
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(normalized);
    if (!match) {
      throw new ValidationError(`Invalid local date: "${input}"`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return LocalDate.of(year, month, day);
  }

  static tryParse(input: string): LocalDate | null {
    try {
      return LocalDate.parse(input);
    } catch {
      return null;
    }
  }

  static of(year: number, month: number, day: number): LocalDate {
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      throw new ValidationError(`Invalid year: ${year}`);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new ValidationError(`Invalid month: ${month}`);
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new ValidationError(`Invalid day: ${day}`);
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new ValidationError(`Invalid calendar date: ${year}-${month}-${day}`);
    }

    return new LocalDate(year, month, day);
  }

  static fromUtcDate(date: Date): LocalDate {
    return LocalDate.of(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  }

  static fromInstant(instant: Date, timeZone: string): LocalDate {
    return LocalDate.parse(localDateStringInZone(instant, timeZone));
  }

  static today(instant: Date, timeZone: string): LocalDate {
    return LocalDate.fromInstant(instant, timeZone);
  }

  addDays(days: number): LocalDate {
    if (!Number.isInteger(days)) {
      throw new ValidationError("Day offset must be an integer");
    }
    const next = new Date(this.toUtcMidnight().getTime() + days * MS_PER_DAY);
    return LocalDate.fromUtcDate(next);
  }

  weekday(): Weekday {
    return weekdayFromUtcDate(this.toUtcMidnight());
  }

  startOfWeekSaturday(): LocalDate {
    return this.addDays(-this.weekday());
  }

  toUtcMidnight(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, this.day));
  }

  toUtcInstant(time: LocalTime, timeZone: string): Date {
    return zonedDateTimeToUtc(
      this.year,
      this.month,
      this.day,
      Math.floor(time.minutes / 60),
      time.minutes % 60,
      timeZone,
    );
  }

  compare(other: LocalDate): number {
    return this.toString().localeCompare(other.toString());
  }

  isBefore(other: LocalDate): boolean {
    return this.compare(other) < 0;
  }

  isAfter(other: LocalDate): boolean {
    return this.compare(other) > 0;
  }

  equals(other: LocalDate): boolean {
    return this.toString() === other.toString();
  }

  isBetweenInclusive(start: LocalDate, end: LocalDate): boolean {
    return !this.isBefore(start) && !this.isAfter(end);
  }

  toString(): string {
    return `${this.year.toString().padStart(4, "0")}-${this.month
      .toString()
      .padStart(2, "0")}-${this.day.toString().padStart(2, "0")}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

export function eachDateInclusive(start: LocalDate, end: LocalDate): LocalDate[] {
  if (start.isAfter(end)) return [];
  const dates: LocalDate[] = [];
  let cursor = start;
  while (!cursor.isAfter(end)) {
    dates.push(cursor);
    cursor = cursor.addDays(1);
  }
  return dates;
}

export function minLocalDate(a: LocalDate, b: LocalDate): LocalDate {
  return a.isBefore(b) ? a : b;
}

export function maxLocalDate(a: LocalDate, b: LocalDate): LocalDate {
  return a.isAfter(b) ? a : b;
}
