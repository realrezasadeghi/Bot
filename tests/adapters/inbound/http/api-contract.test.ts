import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../../../../src/adapters/inbound/http/api/openapi.js';
import { apiRouteManifest } from '../../../../src/adapters/inbound/http/api/route-manifest.js';

const document = buildOpenApiDocument();
const paths = document.paths ?? {};

describe('OpenAPI contract', () => {
	it('documents every mounted route exactly once', () => {
		const documentedPaths = Object.keys(paths).sort();
		const mountedPaths = apiRouteManifest.map((route) => route.path).sort();

		expect(documentedPaths).toEqual(mountedPaths);
	});

	it('uses the manifest operation ids and methods', () => {
		for (const route of apiRouteManifest) {
			const pathItem = paths[route.path];
			expect(pathItem, `missing path ${route.path}`).toBeDefined();

			const operation = pathItem?.[route.method];
			expect(
				operation,
				`missing ${route.method.toUpperCase()} ${route.path}`,
			).toBeDefined();
			expect(operation?.operationId).toBe(route.operationId);
		}
	});

	it('documents no method that the manifest does not declare', () => {
		const httpMethods = ['get', 'post'];

		for (const [path, pathItem] of Object.entries(paths)) {
			const documented = Object.keys(pathItem)
				.filter((key) => httpMethods.includes(key))
				.sort();
			const declared = apiRouteManifest
				.filter((route) => route.path === path)
				.map((route) => route.method)
				.sort();

			expect(documented, `unexpected methods for ${path}`).toEqual(declared);
		}
	});

	it('exposes the API version', () => {
		expect(document.info?.version).toBe('1.0.0');
	});

	it('protects admin operations with bearer auth', () => {
		for (const route of apiRouteManifest) {
			const operation = paths[route.path]?.[route.method];
			if (route.auth === 'admin') {
				expect(operation?.security).toEqual([{ bearerAuth: [] }]);
			} else {
				expect(operation?.security).toEqual([]);
			}
		}
	});

	it('documents both webhook secret headers', () => {
		for (const route of apiRouteManifest) {
			if (route.auth !== 'webhook') continue;
			const operation = paths[route.path]?.[route.method];
			const headerNames = (operation?.parameters ?? [])
				.filter((parameter) => 'in' in parameter && parameter.in === 'header')
				.map((parameter) => ('name' in parameter ? parameter.name : ''));

			expect(headerNames).toContain('x-telegram-bot-api-secret-token');
			expect(headerNames).toContain('x-webhook-secret');
		}
	});

	it('documents the 404 of an unconfigured webhook platform', () => {
		for (const route of apiRouteManifest) {
			if (route.auth !== 'webhook') continue;
			const operation = paths[route.path]?.[route.method];

			expect(
				operation?.responses,
				`missing responses for ${route.path}`,
			).toHaveProperty('404');
		}
	});

	it('declares the bearer security scheme', () => {
		expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({
			type: 'http',
			scheme: 'bearer',
		});
	});

	it('keeps the committed document in sync', async () => {
		const committed = JSON.parse(
			await readFile(resolve(process.cwd(), 'docs/openapi.json'), 'utf8'),
		) as unknown;

		expect(committed).toEqual(document);
	});
});
