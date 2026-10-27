import { ValidationError } from "../shared/errors.js";
import { isValidTimeZone } from "../shared/time-zone.js";

export class User {
  private constructor(
    readonly id: string,
    readonly displayName: string | null,
    readonly timeZone: string,
    readonly locale: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    id: string;
    displayName?: string | null;
    timeZone: string;
    locale: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): User {
    if (!input.id.trim()) throw new ValidationError("User.id is required");
    if (!isValidTimeZone(input.timeZone)) {
      throw new ValidationError(`Invalid user time zone: "${input.timeZone}"`);
    }
    if (!input.locale.trim()) throw new ValidationError("User.locale is required");

    const now = new Date();
    return new User(
      input.id.trim(),
      input.displayName?.trim() || null,
      input.timeZone,
      input.locale.trim(),
      input.createdAt ?? now,
      input.updatedAt ?? input.createdAt ?? now,
    );
  }

  withProfile(input: {
    displayName?: string | null;
    timeZone?: string;
    locale?: string;
    updatedAt?: Date;
  }): User {
    return User.create({
      id: this.id,
      displayName: input.displayName ?? this.displayName,
      timeZone: input.timeZone ?? this.timeZone,
      locale: input.locale ?? this.locale,
      createdAt: this.createdAt,
      updatedAt: input.updatedAt ?? new Date(),
    });
  }
}
