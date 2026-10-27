import type {
  OutboundMessage,
  SendMessageResult,
} from "../../dto/messaging.js";

export interface MessagingPort {
  send(message: OutboundMessage): Promise<SendMessageResult>;
}
