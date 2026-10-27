import { describe, expect, it } from "vitest";
import { LocalDate, eachDateInclusive } from "../../src/domain/shared/local-date.js";
import { LocalTime } from "../../src/domain/shared/local-time.js";
import { Weekday, parseWeekday } from "../../src/domain/shared/weekday.js";

describe("LocalDate", () => {
  it("normalizes Persian digits and separators", () => {
    expect(LocalDate.parse("۱۴۰۵/۰۱/۱۲").toString()).toBe("1405-01-12");
    expect(LocalDate.parse("2026-02-03").toString()).toBe("2026-02-03");
  });

  it("rejects impossible dates", () => {
    expect(() => LocalDate.parse("2026-02-30")).toThrow();
    expect(() => LocalDate.parse("2026-13-01")).toThrow();
  });

  it("uses Saturday as weekday zero", () => {
    expect(LocalDate.parse("2026-01-03").weekday()).toBe(Weekday.Saturday);
    expect(LocalDate.parse("2026-01-04").weekday()).toBe(Weekday.Sunday);
    expect(LocalDate.parse("2026-01-09").weekday()).toBe(Weekday.Friday);
  });

  it("adds days across month and year boundaries", () => {
    expect(LocalDate.parse("2026-01-31").addDays(1).toString()).toBe("2026-02-01");
    expect(LocalDate.parse("2026-12-31").addDays(1).toString()).toBe("2027-01-01");
    expect(LocalDate.parse("2026-01-01").addDays(-1).toString()).toBe("2025-12-31");
  });

  it("enumerates inclusive ranges and returns empty reversed ranges", () => {
    const dates = eachDateInclusive(
      LocalDate.parse("2026-01-01"),
      LocalDate.parse("2026-01-04"),
    ).map(String);
    expect(dates).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
    expect(
      eachDateInclusive(
        LocalDate.parse("2026-01-04"),
        LocalDate.parse("2026-01-01"),
      ),
    ).toEqual([]);
  });

  it("parses Persian and English weekday labels", () => {
    expect(parseWeekday("شنبه")).toBe(Weekday.Saturday);
    expect(parseWeekday("سه‌شنبه")).toBe(Weekday.Tuesday);
    expect(parseWeekday("Wednesday")).toBe(Weekday.Wednesday);
  });
});

describe("LocalTime", () => {
  it("parses normalized times", () => {
    expect(LocalTime.parse("۸:۰۵").toString()).toBe("08:05");
    expect(LocalTime.parse("13:45:59").toString()).toBe("13:45");
  });

  it("wraps around midnight", () => {
    expect(LocalTime.parse("23:30").addMinutes(45).toString()).toBe("00:15");
    expect(LocalTime.parse("00:15").addMinutes(-30).toString()).toBe("23:45");
  });

  it("rejects out-of-range minutes", () => {
    expect(() => LocalTime.fromMinutes(-1)).toThrow();
    expect(() => LocalTime.fromMinutes(1_440)).toThrow();
  });
});
