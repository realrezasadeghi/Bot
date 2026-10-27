import { ConflictError, ValidationError } from '../shared/errors.js';

export enum SubscriptionMode {
	FollowProgram = 'FOLLOW_PROGRAM',
	Customized = 'CUSTOMIZED',
}

export enum SubscriptionStatus {
	Active = 'ACTIVE',
	Unsubscribed = 'UNSUBSCRIBED',
}

export class UserProgramSubscription {
	private constructor(
		readonly id: string,
		readonly userId: string,
		readonly programOfferingId: string,
		readonly mode: SubscriptionMode,
		readonly status: SubscriptionStatus,
		readonly selectedCourseOfferingIds: ReadonlySet<string>,
		readonly createdAt: Date,
		readonly updatedAt: Date,
	) {}

	static create(input: {
		id: string;
		userId: string;
		programOfferingId: string;
		mode?: SubscriptionMode;
		status?: SubscriptionStatus;
		selectedCourseOfferingIds?: Iterable<string>;
		createdAt?: Date;
		updatedAt?: Date;
	}): UserProgramSubscription {
		if (!input.id.trim()) {
			throw new ValidationError('UserProgramSubscription.id is required');
		}
		if (!input.userId.trim()) {
			throw new ValidationError('UserProgramSubscription.userId is required');
		}
		if (!input.programOfferingId.trim()) {
			throw new ValidationError(
				'UserProgramSubscription.programOfferingId is required',
			);
		}

		const mode = input.mode ?? SubscriptionMode.FollowProgram;
		const status = input.status ?? SubscriptionStatus.Active;
		const selected = new Set(
			[...(input.selectedCourseOfferingIds ?? [])].map((value) => value.trim()),
		);

		if ([...selected].some((value) => value.length === 0)) {
			throw new ValidationError('Course selection IDs must not be empty');
		}
		if (mode === SubscriptionMode.FollowProgram && selected.size > 0) {
			throw new ValidationError(
				'FOLLOW_PROGRAM subscriptions must not store explicit course selections',
			);
		}
		if (
			mode === SubscriptionMode.Customized &&
			status === SubscriptionStatus.Active
		) {
			// An explicit empty selection is allowed: it means the student has opted
			// out of all courses while retaining the subscription.
		}

		const now = new Date();
		return new UserProgramSubscription(
			input.id.trim(),
			input.userId.trim(),
			input.programOfferingId.trim(),
			mode,
			status,
			selected,
			input.createdAt ?? now,
			input.updatedAt ?? input.createdAt ?? now,
		);
	}

	isActive(): boolean {
		return this.status === SubscriptionStatus.Active;
	}

	assertActive(): void {
		if (!this.isActive()) {
			throw new ConflictError('Subscription is not active');
		}
	}

	effectiveCourseOfferingIds(
		programCourseOfferingIds: Iterable<string>,
	): ReadonlySet<string> {
		if (!this.isActive()) return new Set();
		if (this.mode === SubscriptionMode.FollowProgram) {
			return new Set(programCourseOfferingIds);
		}
		return new Set(this.selectedCourseOfferingIds);
	}

	customize(
		programCourseOfferingIds: Iterable<string>,
		selectedCourseOfferingIds: Iterable<string>,
	): UserProgramSubscription {
		this.assertActive();
		const programSet = new Set(programCourseOfferingIds);
		const selected = [...selectedCourseOfferingIds];

		for (const courseOfferingId of selected) {
			if (!programSet.has(courseOfferingId)) {
				throw new ValidationError(
					`Course offering ${courseOfferingId} is not part of the subscribed program offering`,
				);
			}
		}

		return UserProgramSubscription.create({
			id: this.id,
			userId: this.userId,
			programOfferingId: this.programOfferingId,
			mode: SubscriptionMode.Customized,
			status: this.status,
			selectedCourseOfferingIds: selected,
			createdAt: this.createdAt,
			updatedAt: new Date(),
		});
	}

	followProgram(): UserProgramSubscription {
		this.assertActive();
		return UserProgramSubscription.create({
			id: this.id,
			userId: this.userId,
			programOfferingId: this.programOfferingId,
			mode: SubscriptionMode.FollowProgram,
			status: this.status,
			createdAt: this.createdAt,
			updatedAt: new Date(),
		});
	}

	unsubscribe(): UserProgramSubscription {
		if (!this.isActive()) return this;
		return UserProgramSubscription.create({
			id: this.id,
			userId: this.userId,
			programOfferingId: this.programOfferingId,
			mode: this.mode,
			status: SubscriptionStatus.Unsubscribed,
			selectedCourseOfferingIds:
				this.mode === SubscriptionMode.Customized
					? this.selectedCourseOfferingIds
					: undefined,
			createdAt: this.createdAt,
			updatedAt: new Date(),
		});
	}
}
