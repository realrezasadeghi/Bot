import { ConflictError } from "../../../domain/shared/errors.js";
import { PlatformIdentity } from "../../../domain/identity/platform-identity.js";
import { User } from "../../../domain/identity/user.js";
import type { IncomingPlatformEvent } from "../../dto/incoming.js";
import type { UserWithIdentity } from "../../ports/outbound/user-repository.js";
import type { Clock } from "../../ports/outbound/clock.js";
import type { IdGenerator } from "../../ports/outbound/id-generator.js";
import type { Logger } from "../../ports/outbound/logger.js";
import type { UnitOfWork } from "../../ports/outbound/unit-of-work.js";

export class RegisterOrResolveUser {
  constructor(
    private readonly deps: {
      uow: UnitOfWork;
      ids: IdGenerator;
      clock: Clock;
      logger: Logger;
      defaultTimeZone: string;
      defaultLocale: string;
    },
  ) {}

  async execute(event: IncomingPlatformEvent): Promise<UserWithIdentity> {
    const lookup = {
      platform: event.platform,
      botScope: event.botScope,
      externalUserId: event.externalUserId,
    };

    const existing = await this.deps.uow.run((repositories) =>
      repositories.users.findByIdentity(lookup),
    );

    if (existing) {
      const needsUpdate =
        existing.identity.externalChatId !== event.externalChatId ||
        (event.username !== null && existing.identity.username !== event.username);

      if (needsUpdate) {
        const now = this.deps.clock.now();
        const updatedIdentity = PlatformIdentity.create({
          id: existing.identity.id,
          userId: existing.identity.userId,
          platform: existing.identity.platform,
          botScope: existing.identity.botScope,
          externalUserId: existing.identity.externalUserId,
          externalChatId: event.externalChatId,
          username: event.username ?? existing.identity.username,
          createdAt: existing.identity.createdAt,
          updatedAt: now,
        });
        await this.deps.uow.run((repositories) =>
          repositories.users.updateIdentity(updatedIdentity),
        );
        return { user: existing.user, identity: updatedIdentity };
      }

      return existing;
    }

    const now = this.deps.clock.now();
    const userId = this.deps.ids.next();
    const user = User.create({
      id: userId,
      displayName: event.displayName,
      timeZone: this.deps.defaultTimeZone,
      locale: event.localeHint ?? this.deps.defaultLocale,
      createdAt: now,
      updatedAt: now,
    });

    try {
      return await this.deps.uow.run(async (repositories) => {
        await repositories.users.createUser(user);
        const identity = PlatformIdentity.create({
          id: this.deps.ids.next(),
          userId: user.id,
          platform: event.platform,
          botScope: event.botScope,
          externalUserId: event.externalUserId,
          externalChatId: event.externalChatId,
          username: event.username,
          createdAt: now,
          updatedAt: now,
        });
        await repositories.users.createIdentity(identity);
        return { user, identity };
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        const raced = await this.deps.uow.run((repositories) =>
          repositories.users.findByIdentity(lookup),
        );
        if (raced) return raced;
      }
      throw error;
    }
  }
}
