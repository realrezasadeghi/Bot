import type { PlatformCode } from "../../../domain/identity/platform-identity.js";

export interface ConversationState {
  userId: string;
  platform: PlatformCode;
  botScope: string;
  step: string;
  data: Readonly<Record<string, string>>;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ConversationStateStore {
  get(input: {
    userId: string;
    platform: PlatformCode;
    botScope: string;
  }): Promise<ConversationState | null>;
  set(state: ConversationState): Promise<void>;
  clear(input: {
    userId: string;
    platform: PlatformCode;
    botScope: string;
  }): Promise<void>;
}
