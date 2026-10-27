import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type {
  ExternalEntityType,
  ExternalIdentifierRepository,
} from "../../../../application/ports/outbound/external-identifier-repository.js";
import type { AppDatabase } from "./db.js";
import { externalIdentifiers } from "./schema.js";

export class PostgresExternalIdentifierRepository
  implements ExternalIdentifierRepository
{
  constructor(private readonly db: AppDatabase) {}

  async record(input: {
    entityType: ExternalEntityType;
    internalId: string;
    sourceKey: string;
    externalId: string;
  }): Promise<void> {
    await this.db
      .insert(externalIdentifiers)
      .values({
        id: randomUUID(),
        entityType: input.entityType,
        internalId: input.internalId,
        sourceKey: input.sourceKey,
        externalId: input.externalId,
      })
      .onConflictDoUpdate({
        target: [
          externalIdentifiers.sourceKey,
          externalIdentifiers.entityType,
          externalIdentifiers.externalId,
        ],
        set: { internalId: input.internalId, updatedAt: new Date() },
      });
  }

  async findInternalId(input: {
    entityType: ExternalEntityType;
    sourceKey: string;
    externalId: string;
  }): Promise<string | null> {
    const [row] = await this.db
      .select({ internalId: externalIdentifiers.internalId })
      .from(externalIdentifiers)
      .where(
        and(
          eq(externalIdentifiers.sourceKey, input.sourceKey),
          eq(externalIdentifiers.entityType, input.entityType),
          eq(externalIdentifiers.externalId, input.externalId),
        ),
      )
      .limit(1);
    return row?.internalId ?? null;
  }
}
