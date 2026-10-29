import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectTypeScriptFiles(path)));
		} else if (entry.isFile() && entry.name.endsWith('.ts')) {
			files.push(path);
		}
	}
	return files;
}

function importedSpecifiers(source: string): string[] {
	return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => {
		const captured = match[1];
		if (captured === undefined)
			throw new Error('unreachable: capture group missing');
		return captured;
	});
}

function forbiddenImports(
	files: ReadonlyArray<{ path: string; source: string }>,
	forbidden: ReadonlyArray<string>,
): string[] {
	const violations: string[] = [];
	for (const file of files) {
		for (const specifier of importedSpecifiers(file.source)) {
			if (forbidden.some((value) => specifier.includes(value))) {
				violations.push(
					`${relative(process.cwd(), file.path)} imports ${specifier}`,
				);
			}
		}
	}
	return violations;
}

describe('hexagonal dependency direction', () => {
	it('keeps the domain independent of application, infrastructure and frameworks', async () => {
		const paths = await collectTypeScriptFiles(join(sourceRoot, 'domain'));
		const files = await Promise.all(
			paths.map(async (path) => ({
				path,
				source: await readFile(path, 'utf8'),
			})),
		);

		expect(
			forbiddenImports(files, [
				'/application/',
				'/adapters/',
				'/config/',
				'express',
				'drizzle-orm',
				'cheerio',
				'pino',
				'dotenv',
				'"pg"',
			]),
		).toEqual([]);
	});

	it('keeps application code independent of adapters and frameworks', async () => {
		const paths = await collectTypeScriptFiles(join(sourceRoot, 'application'));
		const files = await Promise.all(
			paths.map(async (path) => ({
				path,
				source: await readFile(path, 'utf8'),
			})),
		);

		expect(
			forbiddenImports(files, [
				'/adapters/',
				'/config/',
				'express',
				'drizzle-orm',
				'cheerio',
				'pino',
				'dotenv',
				'"pg"',
				'node:http',
				'node:fs',
			]),
		).toEqual([]);
	});
});

describe('renderer service module graph', () => {
	const servicesRoot = join(sourceRoot, 'application', 'services');

	async function readSources(
		directory: string,
	): Promise<ReadonlyArray<{ path: string; source: string }>> {
		const paths = await collectTypeScriptFiles(directory);
		return Promise.all(
			paths.map(async (path) => ({
				path,
				source: await readFile(path, 'utf8'),
			})),
		);
	}

	function resolveLocalImports(
		filePath: string,
		source: string,
	): ReadonlyArray<string> {
		const directory = dirname(filePath);
		return importedSpecifiers(source)
			.filter((specifier) => specifier.startsWith('.'))
			.map((specifier) => {
				const withoutExtension = specifier.replace(/\.js$/, '');
				return resolve(directory, `${withoutExtension}.ts`);
			});
	}

	it('has no import cycles between renderer modules', async () => {
		const files = await readSources(servicesRoot);
		const graph = new Map<string, ReadonlyArray<string>>(
			files.map((file) => [
				file.path,
				resolveLocalImports(file.path, file.source),
			]),
		);

		const cycles: Array<ReadonlyArray<string>> = [];
		const visited = new Set<string>();
		const stack: string[] = [];

		const walk = (node: string): void => {
			const cycleStart = stack.indexOf(node);
			if (cycleStart !== -1) {
				cycles.push([...stack.slice(cycleStart), node]);
				return;
			}
			if (visited.has(node)) return;
			stack.push(node);
			for (const dependency of graph.get(node) ?? []) {
				if (graph.has(dependency)) walk(dependency);
			}
			stack.pop();
			visited.add(node);
		};

		for (const node of graph.keys()) walk(node);

		expect(
			cycles.map((cycle) =>
				cycle.map((path) => relative(process.cwd(), path)).join(' -> '),
			),
		).toEqual([]);
	});

	it('defines shared renderer primitives in exactly one module', async () => {
		const files = await readSources(servicesRoot);
		const sources = files.map((file) => file.source);

		const definitionCounts = {
			BotContent: sources.filter((source) =>
				source.includes('export interface BotContent'),
			).length,
			MAIN_MENU: sources.filter((source) =>
				source.includes('export const MAIN_MENU'),
			).length,
		};

		expect(definitionCounts).toEqual({ BotContent: 1, MAIN_MENU: 1 });
	});
});
