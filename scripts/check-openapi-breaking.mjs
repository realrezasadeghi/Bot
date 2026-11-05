import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseRef = process.env.OPENAPI_BASE_REF ?? 'origin/master';
const basePath = `${baseRef}:docs/openapi.json`;

let baseSpec;
try {
	baseSpec = execFileSync('git', ['show', basePath], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	});
} catch {
	process.stdout.write(
		`No base OpenAPI document at ${basePath}; skipping breaking-change check.\n`,
	);
	process.exit(0);
}

const directory = mkdtempSync(join(tmpdir(), 'openapi-base-'));
const baseFile = join(directory, 'openapi.json');
writeFileSync(baseFile, baseSpec, 'utf8');

try {
	execFileSync('oasdiff', ['breaking', baseFile, 'docs/openapi.json'], {
		stdio: 'inherit',
	});
	process.stdout.write('No breaking OpenAPI changes detected.\n');
} catch (error) {
	if (error && typeof error === 'object' && error.code === 'ENOENT') {
		process.stderr.write(
			'oasdiff is not installed; skipping breaking-change check.\n',
		);
		process.exit(0);
	}
	process.exit(
		error && typeof error === 'object' && 'status' in error
			? (error.status ?? 1)
			: 1,
	);
}
