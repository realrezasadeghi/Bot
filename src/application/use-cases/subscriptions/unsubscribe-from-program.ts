import { NotFoundError } from '../../../domain/shared/errors.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export class UnsubscribeFromProgram {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
		},
	) {}

	async execute(userId: string): Promise<void> {
		const now = this.deps.clock.now();
		await this.deps.uow.run(async (repositories) => {
			const subscription =
				await repositories.subscriptions.findActiveByUserId(userId);
			if (!subscription) {
				throw new NotFoundError('No active program subscription');
			}
			const updated = subscription.unsubscribe();
			await repositories.subscriptions.update(updated);
			await repositories.jobs.cancelPendingBySubscription(
				updated.id,
				now,
				'SUBSCRIPTION_CANCELLED',
			);
		});
	}
}
