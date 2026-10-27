import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTelegramCompatibleUpdate } from "../../src/adapters/inbound/telegram-compatible-webhook.js";
import { TelegramCompatibleMessagingAdapter } from "../../src/adapters/outbound/messaging/telegram-compatible.js";
import { PlatformCode } from "../../src/domain/identity/platform-identity.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseTelegramCompatibleUpdate", () => {
  it("parses a text message", () => {
    const event = parseTelegramCompatibleUpdate({
      platform: PlatformCode.Telegram,
      botScope: "telegram-main",
      update: {
        update_id: 1,
        message: {
          message_id: 10,
          from: {
            id: 123,
            first_name: "Reza",
            last_name: "A",
            username: "reza",
            language_code: "fa",
          },
          chat: { id: 456 },
          text: "/start",
        },
      },
    });

    expect(event).toMatchObject({
      platform: PlatformCode.Telegram,
      botScope: "telegram-main",
      externalUserId: "123",
      externalChatId: "456",
      externalMessageId: "10",
      username: "reza",
      displayName: "Reza A",
      localeHint: "fa",
      kind: "MESSAGE",
      text: "/start",
      callbackData: null,
    });
  });

  it("parses a callback query using the callback message chat", () => {
    const event = parseTelegramCompatibleUpdate({
      platform: PlatformCode.Bale,
      botScope: "bale-main",
      update: {
        callback_query: {
          id: "callback-1",
          from: { id: 123, first_name: "Reza" },
          data: "menu:today",
          message: {
            message_id: 11,
            chat: { id: 456 },
          },
        },
      },
    });

    expect(event).toMatchObject({
      platform: PlatformCode.Bale,
      externalUserId: "123",
      externalChatId: "456",
      externalMessageId: "11",
      kind: "CALLBACK",
      text: null,
      callbackData: "menu:today",
    });
  });

  it("ignores updates without a user or actionable content", () => {
    expect(
      parseTelegramCompatibleUpdate({
        platform: PlatformCode.Telegram,
        botScope: "telegram-main",
        update: { update_id: 1 },
      }),
    ).toBeNull();
    expect(
      parseTelegramCompatibleUpdate({
        platform: PlatformCode.Telegram,
        botScope: "telegram-main",
        update: {
          message: { from: { id: 1 }, chat: { id: 2 }, sticker: {} },
        },
      }),
    ).toBeNull();
  });
});

describe("TelegramCompatibleMessagingAdapter", () => {
  it("sends inline keyboard buttons and returns the provider message id", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 42 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new TelegramCompatibleMessagingAdapter({
      platform: PlatformCode.Telegram,
      token: "token",
      apiBaseUrl: "https://api.telegram.org/",
    });
    const result = await adapter.send({
      recipient: {
        platform: PlatformCode.Telegram,
        botScope: "telegram-main",
        externalUserId: "123",
        externalChatId: "456",
      },
      text: "hello",
      buttons: [[{ text: "Today", callbackData: "menu:today" }]],
    });

    expect(result).toMatchObject({
      provider: "telegram",
      providerMessageId: "42",
      delivered: true,
      retryable: false,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const [url, init] = calls[0]!;
    expect(url).toBe("https://api.telegram.org/bottoken/sendMessage");
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_id: "456",
      text: "hello",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Today", callback_data: "menu:today" }],
        ],
      },
    });
  });

  it("marks 429 responses as retryable with the provider delay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            description: "Too Many Requests",
            error_code: 429,
            parameters: { retry_after: 3 },
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const adapter = new TelegramCompatibleMessagingAdapter({
      platform: PlatformCode.Bale,
      token: "token",
      apiBaseUrl: "https://tapi.bale.ai",
    });
    const result = await adapter.send({
      recipient: {
        platform: PlatformCode.Bale,
        botScope: "bale-main",
        externalUserId: "123",
      },
      text: "hello",
      buttons: [],
    });

    expect(result).toMatchObject({
      provider: "bale",
      delivered: false,
      retryable: true,
      retryAfterMs: 3_000,
      error: "Too Many Requests",
    });
  });
});
