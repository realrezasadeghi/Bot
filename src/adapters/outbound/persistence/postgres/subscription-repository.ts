import { randomUUID } from 'node:crypto';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { SubscriptionRepository } from '../../../../application/ports/outbound/subscription-repository.js';
import { ConflictError } from '../../../../domain/shared/errors.js';
import type { NotificationPreference } from '../../../../domain/subscriptions/notification-preference.js';
import {
	SubscriptionMode,
	SubscriptionStatus,
	type UserProgramSubscription,
} from '../../../../domain/subscriptions/subscription.js';
import type { AppDatabase } from './db.js';
import { toNotificationPreference, toSubscription } from './mappers.js';
import { isUniqueViolation } from './pg-errors.js';
import {
	notificationPreferences,
	userCourseSelections,
	userProgramSubscriptions,
} from './schema.js';

export class PostgresSubscriptionRepository implements SubscriptionRepository {
	constructor(private readonly db: AppDatabase) {}

	async create(
		subscription: UserProgramSubscription,
	): Promise<UserProgramSubscription> {
		try {
			const [row] = await this.db
				.insert(userProgramSubscriptions)
				.values({
					id: subscription.id,
					userId: subscription.userId,
					programOfferingId: subscription.programOfferingId,
					mode: subscription.mode,
					status: subscription.status,
					createdAt: subscription.createdAt,
					updatedAt: subscription.updatedAt,
				})
				.returning();

			if (!row) throw new Error('unreachable: insert should return a row');

			const selectedIds = [...subscription.selectedCourseOfferingIds];
			if (selectedIds.length > 0) {
				await this.db.insert(userCourseSelections).values(
					selectedIds.map((courseOfferingId) => ({
						id: randomUUID(),
						subscriptionId: row.id,
						courseOfferingId,
					})),
				);
			}

			return toSubscription(row, selectedIds);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictError('User already has an active subscription');
			}
			throw error;
		}
	}

	async update(
		subscription: UserProgramSubscription,
	): Promise<UserProgramSubscription> {
		try {
			const [row] = await this.db
				.update(userProgramSubscriptions)
				.set({
					programOfferingId: subscription.programOfferingId,
					mode: subscription.mode,
					status: subscription.status,
					updatedAt: subscription.updatedAt,
				})
				.where(eq(userProgramSubscriptions.id, subscription.id))
				.returning();

			if (!row) throw new ConflictError('Subscription no longer exists');

			await this.db
				.delete(userCourseSelections)
				.where(eq(userCourseSelections.subscriptionId, subscription.id));

			const selectedIds = [...subscription.selectedCourseOfferingIds];
			if (
				subscription.mode === SubscriptionMode.Customized &&
				selectedIds.length > 0
			) {
				await this.db.insert(userCourseSelections).values(
					selectedIds.map((courseOfferingId) => ({
						id: randomUUID(),
						subscriptionId: subscription.id,
						courseOfferingId,
					})),
				);
			}

			return toSubscription(row, selectedIds);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictError('User already has an active subscription');
			}
			throw error;
		}
	}

	async findById(id: string): Promise<UserProgramSubscription | null> {
		const [row] = await this.db
			.select()
			.from(userProgramSubscriptions)
			.where(eq(userProgramSubscriptions.id, id))
			.limit(1);
		if (!row) return null;
		return toSubscription(row, await this.loadSelections(id));
	}

	async findActiveByUserId(
		userId: string,
	): Promise<UserProgramSubscription | null> {
		const [row] = await this.db
			.select()
			.from(userProgramSubscriptions)
			.where(
				and(
					eq(userProgramSubscriptions.userId, userId),
					eq(userProgramSubscriptions.status, SubscriptionStatus.Active),
				),
			)
			.limit(1);
		if (!row) return null;
		return toSubscription(row, await this.loadSelections(row.id));
	}

	async listActive(): Promise<UserProgramSubscription[]> {
		const rows = await this.db
			.select()
			.from(userProgramSubscriptions)
			.where(eq(userProgramSubscriptions.status, SubscriptionStatus.Active));

		if (rows.length === 0) return [];

		const selectionRows = await this.db
			.select()
			.from(userCourseSelections)
			.where(
				inArray(
					userCourseSelections.subscriptionId,
					rows.map((row) => row.id),
				),
			);

		const selectionsBySubscription = new Map<string, string[]>();
		for (const selectionRow of selectionRows) {
			const list = selectionsBySubscription.get(selectionRow.subscriptionId) ?? [];
			list.push(selectionRow.courseOfferingId);
			selectionsBySubscription.set(selectionRow.subscriptionId, list);
		}

		return rows.map((row) =>
			toSubscription(row, selectionsBySubscription.get(row.id) ?? []),
		);
	}

	async deactivateOtherActiveSubscriptions(
		userId: string,
		exceptSubscriptionId: string | null,
	): Promise<number> {
		const conditions = [
			eq(userProgramSubscriptions.userId, userId),
			eq(userProgramSubscriptions.status, SubscriptionStatus.Active),
		];
		if (exceptSubscriptionId) {
			conditions.push(ne(userProgramSubscriptions.id, exceptSubscriptionId));
		}

		const rows = await this.db
			.update(userProgramSubscriptions)
			.set({
				status: SubscriptionStatus.Unsubscribed,
				updatedAt: new Date(),
			})
			.where(and(...conditions))
			.returning({ id: userProgramSubscriptions.id });
		return rows.length;
	}

	async getPreferenceBySubscriptionId(
		subscriptionId: string,
	): Promise<NotificationPreference | null> {
		const [row] = await this.db
			.select()
			.from(notificationPreferences)
			.where(eq(notificationPreferences.subscriptionId, subscriptionId))
			.limit(1);
		return row ? toNotificationPreference(row) : null;
	}

	async upsertPreference(
		preference: NotificationPreference,
	): Promise<NotificationPreference> {
		const [row] = await this.db
			.insert(notificationPreferences)
			.values({
				id: preference.id,
				subscriptionId: preference.subscriptionId,
				dailySummaryEnabled: preference.dailySummaryEnabled,
				dailySummaryMinute: preference.dailySummaryTime.minutes,
				classReminderEnabled: preference.classReminderEnabled,
				reminderOffsetMinutes: preference.reminderOffsetMinutes,
				notifyOnEmptyDays: preference.notifyOnEmptyDays,
				updatedAt: preference.updatedAt,
			})
			.onConflictDoUpdate({
				target: notificationPreferences.subscriptionId,
				set: {
					dailySummaryEnabled: preference.dailySummaryEnabled,
					dailySummaryMinute: preference.dailySummaryTime.minutes,
					classReminderEnabled: preference.classReminderEnabled,
					reminderOffsetMinutes: preference.reminderOffsetMinutes,
					notifyOnEmptyDays: preference.notifyOnEmptyDays,
					updatedAt: preference.updatedAt,
				},
			})
			.returning();
		if (!row) throw new Error('unreachable: upsert should return a row');
		return toNotificationPreference(row);
	}

	private async loadSelections(subscriptionId: string): Promise<string[]> {
		const rows = await this.db
			.select({ courseOfferingId: userCourseSelections.courseOfferingId })
			.from(userCourseSelections)
			.where(eq(userCourseSelections.subscriptionId, subscriptionId));
		return rows.map((row) => row.courseOfferingId);
	}
}
