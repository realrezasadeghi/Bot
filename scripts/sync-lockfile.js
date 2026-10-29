import { execSync } from 'node:child_process';

/**
 * sync-lockfile.js
 *
 * Runs after @semantic-release/npm updates package.json with the new release
 * version. Synchronizes pnpm-lock.yaml with the updated package.json so the
 * lockfile always matches the released package version.
 *
 * Exits non-zero if pnpm install fails, which aborts the Semantic Release
 * preparation before any commit or tag is created.
 */

try {
	execSync('pnpm install --no-frozen-lockfile', {
		stdio: 'inherit',
	});
} catch (error) {
	process.stderr.write(
		`::error::Failed to synchronize pnpm-lock.yaml: ${error.message}\n`,
	);
	process.exit(1);
}
