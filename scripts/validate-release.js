/** biome-ignore-all lint/suspicious/noConsole: <console log> */
import { execFileSync } from 'node:child_process';

function fail(message) {
	console.error(`Release validation failed: ${message}`);
	process.exit(1);
}

const releaseTag = process.env.RELEASE_TAG;

if (!releaseTag) {
	fail('RELEASE_TAG environment variable is required.');
}

// 1. Validate semantic version format.
if (!/^v\d+\.\d+\.\d+$/.test(releaseTag)) {
	fail(`Invalid release tag: ${releaseTag}`);
}

function git(...args) {
	try {
		return execFileSync('git', args, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'inherit'],
		}).trim();
	} catch {
		fail(`Git command failed: ${args.join(' ')}`);
	}
}

// 2. Verify that the release tag exists locally.
try {
	execFileSync(
		'git',
		['show-ref', '--verify', '--quiet', `refs/tags/${releaseTag}`],
		{ stdio: 'ignore' },
	);
} catch {
	fail(`Tag ${releaseTag} is not available locally. Fetch Git tags first.`);
}

// 3. Verify checked-out commit.
const checkedOutCommit = git('rev-parse', 'HEAD');

const tagCommit = git('rev-parse', `${releaseTag}^{commit}`);

if (checkedOutCommit !== tagCommit) {
	fail('Checked out commit does not match release tag.');
}

console.log('Release validation successful.');
console.log(`Tag: ${releaseTag}`);
console.log(`Commit: ${checkedOutCommit}`);
