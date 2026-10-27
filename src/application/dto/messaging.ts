import type { PlatformCode } from "../../domain/identity/platform-identity.js";

export interface OutboundButton {
  text: string;
  callbackData: string;
}

export interface OutboundRecipient {
  platform: PlatformCode;
  botScope: string;
  externalUserId: string;
  externalChatId?: string | null;
}

export interface OutboundMessage {
  recipient: OutboundRecipient;
  text: string;
  buttons: OutboundButton[][];
}

export interface SendMessageResult {
  provider: string;
  providerMessageId: string | null;
  delivered: boolean;
  retryable: boolean;
  retryAfterMs: number | null;
  error: string | null;
}
