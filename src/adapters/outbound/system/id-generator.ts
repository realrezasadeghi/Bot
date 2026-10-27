import { randomUUID } from "node:crypto";
import type { IdGenerator } from "../../../application/ports/outbound/id-generator.js";

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
