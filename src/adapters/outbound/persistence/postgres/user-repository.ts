import { and, desc, eq } from 'drizzle-orm';
import type {
	IdentityLookup,
	UserRepository,
	UserWithIdentity,
} from '../../../../application/ports/outbound/user-repository.js';
import type { PlatformIdentity } from '../../../../domain/identity/platform-identity.js';
import type { User } from '../../../../domain/identity/user.js';
import { ConflictError } from '../../../../domain/shared/errors.js';
import type { AppDatabase } from './db.js';
import { toPlatformIdentity, toUser } from './mappers.js';
import { isUniqueViolation } from './pg-errors.js';
import { platformIdentities, users } from './schema.js';

export class PostgresUserRepository implements UserRepository {
	constructor(private readonly db: AppDatabase) {}

	async findUserById(id: string): Promise<User | null> {
		const [row] = await this.db
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return row ? toUser(row) : null;
	}

	async findByIdentity(
		lookup: IdentityLookup,
	): Promise<UserWithIdentity | null> {
		const [row] = await this.db
			.select({ user: users, identity: platformIdentities })
			.from(platformIdentities)
			.innerJoin(users, eq(platformIdentities.userId, users.id))
			.where(
				and(
					eq(platformIdentities.platform, lookup.platform),
					eq(platformIdentities.botScope, lookup.botScope),
					eq(platformIdentities.externalUserId, lookup.externalUserId),
				),
			)
			.limit(1);

		if (!row) return null;
		return {
			user: toUser(row.user),
			identity: toPlatformIdentity(row.identity),
		};
	}

	async createUser(user: User): Promise<User> {
		const [row] = await this.db
			.insert(users)
			.values({
				id: user.id,
				displayName: user.displayName,
				timeZone: user.timeZone,
				locale: user.locale,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			})
			.returning();
		if (!row) throw new Error('unreachable: insert should return a row');
		return toUser(row);
	}

	async updateUser(user: User): Promise<User> {
		const [row] = await this.db
			.update(users)
			.set({
				displayName: user.displayName,
				timeZone: user.timeZone,
				locale: user.locale,
				updatedAt: user.updatedAt,
			})
			.where(eq(users.id, user.id))
			.returning();
		if (!row) throw new ConflictError('User no longer exists');
		return toUser(row);
	}

	async createIdentity(identity: PlatformIdentity): Promise<PlatformIdentity> {
		try {
			const [row] = await this.db
				.insert(platformIdentities)
				.values({
					id: identity.id,
					userId: identity.userId,
					platform: identity.platform,
					botScope: identity.botScope,
					externalUserId: identity.externalUserId,
					externalChatId: identity.externalChatId,
					username: identity.username,
					createdAt: identity.createdAt,
					updatedAt: identity.updatedAt,
				})
				.returning();
			if (!row) throw new Error('unreachable: insert should return a row');
			return toPlatformIdentity(row);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictError('This platform identity is already linked');
			}
			throw error;
		}
	}

	async updateIdentity(identity: PlatformIdentity): Promise<PlatformIdentity> {
		try {
			const [row] = await this.db
				.update(platformIdentities)
				.set({
					externalChatId: identity.externalChatId,
					username: identity.username,
					updatedAt: identity.updatedAt,
				})
				.where(eq(platformIdentities.id, identity.id))
				.returning();
			if (!row) throw new ConflictError('Platform identity no longer exists');
			return toPlatformIdentity(row);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictError('This platform identity is already linked');
			}
			throw error;
		}
	}

	async findIdentityById(id: string): Promise<PlatformIdentity | null> {
		const [row] = await this.db
			.select()
			.from(platformIdentities)
			.where(eq(platformIdentities.id, id))
			.limit(1);
		return row ? toPlatformIdentity(row) : null;
	}

	async listIdentitiesForUser(userId: string): Promise<PlatformIdentity[]> {
		const rows = await this.db
			.select()
			.from(platformIdentities)
			.where(eq(platformIdentities.userId, userId))
			.orderBy(desc(platformIdentities.updatedAt));
		return rows.map(toPlatformIdentity);
	}

	async findPreferredIdentityForUser(
		userId: string,
	): Promise<PlatformIdentity | null> {
		const [row] = await this.db
			.select()
			.from(platformIdentities)
			.where(eq(platformIdentities.userId, userId))
			.orderBy(desc(platformIdentities.updatedAt))
			.limit(1);
		return row ? toPlatformIdentity(row) : null;
	}
}
