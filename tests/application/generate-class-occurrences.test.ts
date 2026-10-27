import { describe, expect, it, vi } from "vitest";
import { AcademicTerm } from "../../src/domain/academic/entities.js";
import { LocalDate } from "../../src/domain/shared/local-date.js";
import { GenerateClassOccurrences } from "../../src/application/use-cases/scheduling/generate-class-occurrences.js";
import type { Repositories } from "../../src/application/ports/outbound/unit-of-work.js";

const now = new Date("2026-01-10T00:00:00.000Z");
const term = AcademicTerm.create({
  id: "term-1",
  externalCode: "14051",
  title: "1405-1",
  startsOn: LocalDate.parse("2026-01-01"),
  endsOn: LocalDate.parse("2026-01-31"),
  isActive: true,
});

function buildUseCase(reconcileAbsent: boolean) {
  const cancelFutureNotInKeys = vi.fn(async () => ["occurrence-1"]);
  const cancelPendingByOccurrenceIds = vi.fn(async () => 1);
  const repositories = {
    academic: {
      getTermById: vi.fn(async () => term),
      listCourseOfferingIdsByTerm: vi.fn(async () => []),
    },
    occurrences: { cancelFutureNotInKeys },
    jobs: { cancelPendingByOccurrenceIds },
  } as unknown as Repositories;

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);

  const useCase = new GenerateClassOccurrences({
    uow: { run: async (work) => work(repositories) },
    ids: { next: () => "id" },
    clock: { now: () => now },
    logger,
    horizonDays: 14,
    appTimeZone: "Asia/Tehran",
  });

  return {
    useCase,
    reconcileAbsent,
    cancelFutureNotInKeys,
    cancelPendingByOccurrenceIds,
  };
}

describe("GenerateClassOccurrences reconciliation", () => {
  it("cancels future occurrences when a term has no active course offerings", async () => {
    const { useCase, cancelFutureNotInKeys, cancelPendingByOccurrenceIds } =
      buildUseCase(true);

    const result = await useCase.execute({
      termId: term.id,
      reconcileAbsent: true,
    });

    expect(result.cancelled).toBe(1);
    expect(result.cancelledOccurrenceIds).toEqual(["occurrence-1"]);
    expect(cancelFutureNotInKeys).toHaveBeenCalledWith(
      expect.objectContaining({ termId: term.id, keepKeys: new Set() }),
    );
    expect(cancelPendingByOccurrenceIds).toHaveBeenCalledWith(
      ["occurrence-1"],
      now,
      "OCCURRENCE_CHANGED_OR_CANCELLED",
    );
  });

  it("leaves future occurrences untouched when reconciliation is disabled", async () => {
    const { useCase, cancelFutureNotInKeys, cancelPendingByOccurrenceIds } =
      buildUseCase(false);

    const result = await useCase.execute({
      termId: term.id,
      reconcileAbsent: false,
    });

    expect(result.cancelled).toBe(0);
    expect(cancelFutureNotInKeys).not.toHaveBeenCalled();
    expect(cancelPendingByOccurrenceIds).not.toHaveBeenCalled();
  });
});
