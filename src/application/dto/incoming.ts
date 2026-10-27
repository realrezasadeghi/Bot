import type { PlatformCode } from "../../domain/identity/platform-identity.js";

export type IncomingPlatformEventKind = "MESSAGE" | "CALLBACK";

export interface IncomingPlatformEvent {
  platform: PlatformCode;
  botScope: string;
  externalUserId: string;
  externalChatId: string;
  externalMessageId: string | null;
  username: string | null;
  displayName: string | null;
  localeHint: string | null;
  kind: IncomingPlatformEventKind;
  text: string | null;
  callbackData: string | null;
  receivedAt: Date;
}
