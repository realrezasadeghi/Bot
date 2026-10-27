import type { SubscriptionDto } from "../../dto/schedule.js";
import { toSubscriptionDto } from "../../services/dto-mappers.js";
import type { UnitOfWork } from "../../ports/outbound/unit-of-work.js";

export class GetCurrentSubscription {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(userId: string): Promise<SubscriptionDto | null> {
    return this.uow.run(async (repositories) => {
      const subscription =
        await repositories.subscriptions.findActiveByUserId(userId);
      if (!subscription) return null;

      const programOffering = await repositories.academic.getProgramOffering(
        subscription.programOfferingId,
      );
      if (!programOffering) return null;

      const preference =
        await repositories.subscriptions.getPreferenceBySubscriptionId(
          subscription.id,
        );
      if (!preference) {
        return {
          id: subscription.id,
          programOfferingId: subscription.programOfferingId,
          programTitle: programOffering.programOffering.title,
          termTitle: programOffering.term.title,
          mode: subscription.mode,
          status: subscription.status,
          selectedCourseOfferingIds: [
            ...subscription.selectedCourseOfferingIds,
          ],
          preferences: null,
        };
      }

      return toSubscriptionDto({
        subscription,
        preference,
        programOffering,
      });
    });
  }
}

export interface ProgramCourseDto {
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  instructorName: string | null;
  selected: boolean;
}

export interface ProgramCoursesDto {
  programTitle: string;
  mode: "FOLLOW_PROGRAM" | "CUSTOMIZED";
  courses: ProgramCourseDto[];
}

export class GetProgramCourses {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(userId: string): Promise<ProgramCoursesDto | null> {
    return this.uow.run(async (repositories) => {
      const subscription =
        await repositories.subscriptions.findActiveByUserId(userId);
      if (!subscription) return null;

      const programOffering = await repositories.academic.getProgramOffering(
        subscription.programOfferingId,
      );
      if (!programOffering) return null;

      const allOfferings = await repositories.academic.listCourseOfferingsByTerm(
        programOffering.term.id,
      );
      const programCourseIds = new Set(programOffering.courseOfferingIds);
      const selectedIds = subscription.effectiveCourseOfferingIds(
        programOffering.courseOfferingIds,
      );

      return {
        programTitle: programOffering.programOffering.title,
        mode: subscription.mode,
        courses: allOfferings
          .filter((view) => programCourseIds.has(view.courseOffering.id))
          .map((view) => ({
            courseOfferingId: view.courseOffering.id,
            courseCode: view.course.code,
            courseTitle: view.course.title,
            instructorName:
              view.instructors.length > 0
                ? view.instructors
                    .map((instructor) => instructor.fullName)
                    .join("، ")
                : null,
            selected: selectedIds.has(view.courseOffering.id),
          })),
      };
    });
  }
}
