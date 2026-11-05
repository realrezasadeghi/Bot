import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import {
	ErrorEnvelopeSchema,
	WebhookIgnoredSchema,
	WebhookSuccessSchema,
	WebhookUnauthorizedSchema,
} from '../../../../src/adapters/inbound/http/api/contracts/index.js';
import { createHttpApi } from '../../../../src/adapters/inbound/http/http-api.js';
import {
	actionableTelegramUpdate,
	balePlatform,
	createFakeHttpDependencies,
	telegramPlatform,
} from '../../../fixtures/http-api-dependencies.js';

describe('webhook routes', () => {
	it('rejects a Telegram update with the wrong secret', async () => {
		const { dependencies } = createFakeHttpDependencies({
			webhookPlatforms: [telegramPlatform],
		});

		const response = await supertest(createHttpApi(dependencies))
			.post('/api/webhooks/telegram')
			.set('x-telegram-bot-api-secret-token', 'wrong-secret')
			.send(actionableTelegramUpdate);

		expect(response.status).toBe(401);
		expect(WebhookUnauthorizedSchema.parse(response.body)).toEqual({
			ok: false,
			error: 'INVALID_WEBHOOK_SECRET',
		});
	});

	it('ignores a Telegram update without actionable content', async () => {
		const fixture = createFakeHttpDependencies({
			webhookPlatforms: [telegramPlatform],
		});

		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/webhooks/telegram')
			.set('x-telegram-bot-api-secret-token', 'telegram-secret')
			.send({ update_id: 1 });

		expect(response.status).toBe(200);
		expect(WebhookIgnoredSchema.parse(response.body)).toEqual({
			ok: true,
			ignored: true,
		});
		expect(fixture.handleIncoming.execute).not.toHaveBeenCalled();
	});

	it('handles an actionable Telegram update', async () => {
		const fixture = createFakeHttpDependencies({
			webhookPlatforms: [telegramPlatform],
		});

		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/webhooks/telegram')
			.set('x-telegram-bot-api-secret-token', 'telegram-secret')
			.send(actionableTelegramUpdate);

		expect(response.status).toBe(200);
		expect(WebhookSuccessSchema.parse(response.body)).toEqual({ ok: true });
		expect(fixture.handleIncoming.execute).toHaveBeenCalledOnce();
		expect(fixture.messaging.send).toHaveBeenCalledOnce();
	});

	it('still acknowledges the update when delivery fails', async () => {
		const fixture = createFakeHttpDependencies({
			webhookPlatforms: [telegramPlatform],
		});
		fixture.messaging.send.mockResolvedValueOnce({
			provider: 'telegram',
			providerMessageId: null,
			delivered: false,
			retryable: true,
			retryAfterMs: null,
			error: 'network error',
		});

		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/webhooks/telegram')
			.set('x-telegram-bot-api-secret-token', 'telegram-secret')
			.send(actionableTelegramUpdate);

		expect(response.status).toBe(200);
		expect(WebhookSuccessSchema.parse(response.body)).toEqual({ ok: true });
	});

	it('returns 404 for a webhook of an unconfigured platform', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies)).post(
			'/api/webhooks/bale',
		);

		expect(response.status).toBe(404);
		expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe('NOT_FOUND');
	});

	it('accepts the generic webhook secret header for Bale', async () => {
		const fixture = createFakeHttpDependencies({
			webhookPlatforms: [balePlatform],
		});

		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/webhooks/bale')
			.set('x-webhook-secret', 'bale-secret')
			.send(actionableTelegramUpdate);

		expect(response.status).toBe(200);
		expect(WebhookSuccessSchema.parse(response.body)).toEqual({ ok: true });
		expect(fixture.handleIncoming.execute).toHaveBeenCalledOnce();
	});
});
