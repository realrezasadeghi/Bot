import type {
  Repositories,
  UnitOfWork,
} from "../../../../application/ports/outbound/unit-of-work.js";
import type { AppDatabase } from "./db.js";
import { PostgresAcademicCatalogRepository } from "./academic-catalog-repository.js";
import { PostgresClassOccurrenceRepository } from "./occurrence-repository.js";
import { PostgresExternalIdentifierRepository } from "./external-identifier-repository.js";
import { PostgresNotificationJobRepository } from "./notification-job-repository.js";
import { PostgresSubscriptionRepository } from "./subscription-repository.js";
import { PostgresSyncRunRepository } from "./sync-run-repository.js";
import { PostgresUserRepository } from "./user-repository.js";

export function createRepositories(db: AppDatabase): Repositories {
  return {
    academic: new PostgresAcademicCatalogRepository(db),
    externalIds: new PostgresExternalIdentifierRepository(db),
    users: new PostgresUserRepository(db),
    subscriptions: new PostgresSubscriptionRepository(db),
    occurrences: new PostgresClassOccurrenceRepository(db),
    jobs: new PostgresNotificationJobRepository(db),
    syncRuns: new PostgresSyncRunRepository(db),
  };
}

export class PostgresUnitOfWork implements UnitOfWork {
  constructor(private readonly db: AppDatabase) {}

  async run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return work(createRepositories(tx as unknown as AppDatabase));
    });
  }
}
