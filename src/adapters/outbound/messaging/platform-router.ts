import type {
  OutboundMessage,
  SendMessageResult,
} from "../../../application/dto/messaging.js";
import type { MessagingPort } from "../../../application/ports/outbound/messaging.js";
import type { PlatformCode } from "../../../domain/identity/platform-identity.js";

export class PlatformMessagingRouter implements MessagingPort {
  constructor(
    private readonly adapters: ReadonlyMap<PlatformCode, MessagingPort>,
  ) {}

  async send(message: OutboundMessage): Promise<SendMessageResult> {
    const adapter = this.adapters.get(message.recipient.platform);
    if (!adapter) {
      return {
        provider: message.recipient.platform,
        providerMessageId: null,
        delivered: false,
        retryable: false,
        retryAfterMs: null,
        error: `No messaging adapter configured for ${message.recipient.platform}`,
      };
    }
    return adapter.send(message);
  }
}
