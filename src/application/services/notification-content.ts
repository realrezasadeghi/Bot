import type { ScheduleEntryDto } from "../dto/schedule.js";

function formatEntry(entry: ScheduleEntryDto): string {
  const instructor = entry.instructorName ? ` | ${entry.instructorName}` : "";
  const location = entry.location ? ` | ${entry.location}` : "";
  const cancelled = entry.status === "CANCELLED" ? " (لغو شده)" : "";
  return `${entry.startTime}-${entry.endTime} | ${entry.courseTitle} (${entry.courseCode})${instructor}${location}${cancelled}`;
}

export function formatClassReminder(input: {
  entry: ScheduleEntryDto;
  offsetMinutes: number;
}): string {
  const { entry } = input;
  const lines = [
    "یادآوری کلاس",
    `${entry.weekdayLabel} ${entry.date}`,
    `${entry.startTime} تا ${entry.endTime}`,
    `${entry.courseTitle} (${entry.courseCode})`,
  ];
  if (entry.instructorName) lines.push(`استاد: ${entry.instructorName}`);
  if (entry.location) lines.push(`مکان: ${entry.location}`);
  lines.push(`شروع کلاس تا ${input.offsetMinutes} دقیقه دیگر است.`);
  return lines.join("\n");
}

export function formatDailySummary(input: {
  date: string;
  entries: ReadonlyArray<ScheduleEntryDto>;
  notifyOnEmptyDays: boolean;
}): string {
  const weekday = input.entries[0]?.weekdayLabel;
  const heading = weekday
    ? `برنامه کلاسی ${weekday} ${input.date}`
    : `برنامه کلاسی ${input.date}`;

  if (input.entries.length === 0) {
    return input.notifyOnEmptyDays
      ? `${heading}\n\nامروز کلاسی ندارید.`
      : `${heading}\n\nامروز کلاسی ندارید.`;
  }

  return [heading, "", ...input.entries.map((entry) => `- ${formatEntry(entry)}`)].join(
    "\n",
  );
}

export function truncateMessage(text: string, maxLength = 3_800): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 20))}\n...`;
}
