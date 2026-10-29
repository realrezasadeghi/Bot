import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * validate-release.js
 *
 * Validates that a Git release tag and package.json agree on the application
 * version before a Docker image is published. Intended to run in CI on a
 * `refs/tags/v*` push.
 *
 * Exits non-zero (with a GitHub Actions error annotation) on any problem so
 * the release job fails before any image is built or published.
 */

function fail(message) {
	process.stderr.write(`::error::${message}\n`);
	process.exit(1);
}

function notice(message) {
	process.stdout.write(`::notice::${message}\n`);
}

// ---------------------------------------------------------------------------
// Resolve the ref we are releasing from.
// ---------------------------------------------------------------------------
let ref = process.env.GITHUB_REF;

if (!ref) {
	// Local execution fallback: discover the exact tag on HEAD.
	try {
		const tag = execSync('git describe --tags --exact-match HEAD 2>/dev/null', {
			encoding: 'utf8',
			// Keep stderr out of the error message; we handle the failure below.
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();
		if (!tag) {
			fail(
				'Not on a version tag. Set GITHUB_REF=refs/tags/v1.2.3 or run this on a tag commit.',
			);
		}
		ref = `refs/tags/${tag}`;
	} catch {
		fail('Not on a version tag and GITHUB_REF is not set.');
	}
}

if (!ref.startsWith('refs/tags/')) {
	fail(`Release can only be triggered from a git tag, got ref: ${ref}`);
}

const tag = ref.slice('refs/tags/'.length);

// SemVer with optional leading "v", optional pre-release and build metadata.
// Capture groups: 2=major, 3=minor, 4=patch, 6=prerelease (without leading "-").
const semverRe =
	/^(v)?(\d+)\.(\d+)\.(\d+)(-([0-9A-Za-z.-]+))?(\+([0-9A-Za-z.-]+))?$/;
const m = tag.match(semverRe);
if (!m) {
	fail(
		`Tag "${tag}" is not a valid SemVer tag. Expected vMAJOR.MINOR.PATCH, e.g. v1.2.3.`,
	);
}

const tagVersion = `${m[2]}.${m[3]}.${m[4]}`;
const prerelease = m[6]; // undefined when the release is stable

// ---------------------------------------------------------------------------
// Read package.json and compare versions.
// ---------------------------------------------------------------------------
const pkgPath = path.resolve(process.cwd(), 'package.json');
let pkg;
try {
	pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
} catch (err) {
	fail(`Failed to read package.json: ${err.message}`);
}

const pkgVersion = pkg.version;
if (typeof pkgVersion !== 'string' || pkgVersion.length === 0) {
	fail('package.json has no version field.');
}

if (pkgVersion !== tagVersion) {
	fail(
		`Version mismatch: git tag "${tag}" implies version "${tagVersion}" but package.json version is "${pkgVersion}". ` +
			'Bump package.json to match the tag before creating the release.',
	);
}

notice(`Version validated: tag=${tag} package.json=${pkgVersion}`);

if (prerelease) {
	notice(`Prerelease detected: ${prerelease} (will not be tagged as "latest")`);
} else {
	notice('Stable release (eligible for "latest" tag)');
}
