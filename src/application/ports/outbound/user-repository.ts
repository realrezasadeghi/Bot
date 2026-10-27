import type { PlatformIdentity } from "../../../domain/identity/platform-identity.js";
import type { PlatformCode } from "../../../domain/identity/platform-identity.js";
import type { User } from "../../../domain/identity/user.js";

export interface IdentityLookup {
  platform: PlatformCode;
  botScope: string;
  externalUserId: string;
}

export interface UserWithIdentity {
  user: User;
  identity: PlatformIdentity;
}

export interface UserRepository {
  findUserById(id: string): Promise<User | null>;
  findByIdentity(lookup: IdentityLookup): Promise<UserWithIdentity | null>;
  createUser(user: User): Promise<User>;
  updateUser(user: User): Promise<User>;
  createIdentity(identity: PlatformIdentity): Promise<PlatformIdentity>;
  updateIdentity(identity: PlatformIdentity): Promise<PlatformIdentity>;
  findIdentityById(id: string): Promise<PlatformIdentity | null>;
  listIdentitiesForUser(userId: string): Promise<PlatformIdentity[]>;
  findPreferredIdentityForUser(userId: string): Promise<PlatformIdentity | null>;
}
