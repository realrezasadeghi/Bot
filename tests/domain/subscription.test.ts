import { describe, expect, it } from "vitest";
import {
  SubscriptionMode,
  SubscriptionStatus,
  UserProgramSubscription,
} from "../../src/domain/subscriptions/subscription.js";

function subscription(
  input: Partial<Parameters<typeof UserProgramSubscription.create>[0]> = {},
) {
  return UserProgramSubscription.create({
    id: "subscription-1",
    userId: "user-1",
    programOfferingId: "program-offering-1",
    ...input,
  });
}

describe("UserProgramSubscription", () => {
  it("forbids explicit selections in follow-program mode", () => {
    expect(() =>
      subscription({
        mode: SubscriptionMode.FollowProgram,
        selectedCourseOfferingIds: ["course-1"],
      }),
    ).toThrow();
  });

  it("allows an empty customized selection", () => {
    const value = subscription({
      mode: SubscriptionMode.Customized,
      selectedCourseOfferingIds: [],
    });
    expect(value.selectedCourseOfferingIds.size).toBe(0);
    expect(value.effectiveCourseOfferingIds(["course-1"]).size).toBe(0);
  });

  it("rejects selected courses outside the subscribed program", () => {
    const value = subscription({ mode: SubscriptionMode.Customized });
    expect(() =>
      value.customize(["course-1", "course-2"], ["course-3"]),
    ).toThrow();
  });

  it("returns all program courses in follow-program mode", () => {
    const value = subscription();
    expect([...value.effectiveCourseOfferingIds(["course-1", "course-2"])]).toEqual([
      "course-1",
      "course-2",
    ]);
  });

  it("returns no effective courses after unsubscribe", () => {
    const value = subscription().unsubscribe();
    expect(value.status).toBe(SubscriptionStatus.Unsubscribed);
    expect(value.effectiveCourseOfferingIds(["course-1"]).size).toBe(0);
  });
});
