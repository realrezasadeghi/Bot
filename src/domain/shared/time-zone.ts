import { ValidationError } from "./errors.js";

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new ValidationError(`Invalid IANA time zone: "${timeZone}"`);
  }

  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function zonedDateTimeParts(instant: Date, timeZone: string): ZonedDateTimeParts {
  if (Number.isNaN(instant.getTime())) {
    throw new ValidationError("Invalid instant");
  }

  const parts = getFormatter(timeZone).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  const read = (key: keyof Intl.DateTimeFormatPartTypesRegistry): number => {
    const raw = values.get(key);
    if (raw === undefined) {
      throw new ValidationError(`Unable to read ${key} for time zone ${timeZone}`);
    }
    return Number(raw);
  };

  const hour = read("hour");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
    second: read("second"),
  };
}

export function localDateStringInZone(instant: Date, timeZone: string): string {
  const parts = zonedDateTimeParts(instant, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function localTimeMinutesInZone(instant: Date, timeZone: string): number {
  const parts = zonedDateTimeParts(instant, timeZone);
  return parts.hour * 60 + parts.minute;
}

/**
 * Converts a wall-clock date/time in an IANA time zone to a UTC instant.
 * Ambiguous times during a DST overlap resolve to the first matching instant.
 * Non-existent times during a DST gap are rejected.
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(targetAsUtc)) {
    throw new ValidationError("Invalid local date/time");
  }

  let guess = targetAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = zonedDateTimeParts(new Date(guess), timeZone);
    const renderedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const difference = renderedAsUtc - guess;
    if (difference === 0) break;
    guess -= difference;
  }

  const finalParts = zonedDateTimeParts(new Date(guess), timeZone);
  if (
    finalParts.year !== year ||
    finalParts.month !== month ||
    finalParts.day !== day ||
    finalParts.hour !== hour ||
    finalParts.minute !== minute
  ) {
    throw new ValidationError(
      `Local date/time ${year}-${month}-${day} ${hour}:${minute} does not exist in ${timeZone}`,
    );
  }

  return new Date(guess);
}
