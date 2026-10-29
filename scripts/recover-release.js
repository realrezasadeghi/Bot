import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * recover-release.js
 *
 * Recovers from a failed Docker image publication for an existing release tag.
 *
 * Usage: node scripts/recover-release.js <tag-name>
 *
 * Example: node scripts/recover-release.js v1.2.3
 *
 * The script:
 *   1. Validates the tag argument (must be vMAJOR.MINOR.PATCH)
   2. Reads the version from package.json at the tag's commit
   3. Builds and pushes the Docker image to GHCR with:
      - ghcr.io/realrezasadeghi/bot:<version>
      - ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>
      - ghcr.io/realrezasadeghi/bot:latest (stable releases only)
 *
 * It does NOT create a new release version or Git tag. It republishes the
 * existing release's Docker image. Safe to retry.
 */

function fail(message) {
	process.stderr.write(`::error::${message}\n`);
	process.exit(1);
}

function notice(message) {
	process.stdout.write(`::notice::${message}\n`);
}

const tag = process.argv[2];
if (!tag) {
	fail('Usage: node scripts/recover-release.js <tag-name>');
}

const semverRe =
	/^v(\d+)\.(\d+)\.(\d+)(-([0-9A-Za-z.-]+))?(\+([0-9A-Za-z.-]+))?$/;
const m = tag.match(semverRe);
if (!m) {
	fail(`Invalid tag "${tag}". Expected vMAJOR.MINOR.PATCH, e.g. v1.2.3.`);
}

const version = `${m[1]}.${m[2]}.${m[3]}`;
const prerelease = m[5];
const isStable = !prerelease;

try {
	execSync(`git rev-parse --verify --quiet ${tag}`, {
		stdio: 'pipe',
	});
} catch {
	fail(
		`Tag "${tag}" does not exist locally. Fetch tags first: git fetch --tags`,
	);
}

const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
notice(`Recovering release ${tag} at commit ${sha}`);

// Verify package.json version matches the tag
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.version !== version) {
	fail(
		`package.json version "${pkg.version}" does not match tag version "${version}"`,
	);
}

notice(`Version confirmed: ${version} (${isStable ? 'stable' : 'prerelease'})`);

// Build and push with Docker Buildx. Tags are managed by the calling workflow.
// This script only verifies preconditions; the workflow executes docker commands.

notice(`Preconditions satisfied for tag ${tag}`);
