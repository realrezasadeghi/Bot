export default {
	branches: [
		{
			name: 'master',
			prerelease: false,
		},
	],
	preset: 'conventionalcommits',
	tagFormat: 'v${version}',
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				preset: 'conventionalcommits',
				releaseRules: [
					{ type: 'fix', release: 'patch' },
					{ type: 'feat', release: 'minor' },
					{ type: 'feat', scope: '*', release: 'minor' },
					{ type: 'perf', release: 'patch' },
					{ type: 'refactor', release: 'patch' },
					{ type: 'test', release: false },
					{ type: 'docs', release: false },
					{ type: 'chore', release: false },
					{ type: 'style', release: false },
					{ type: 'ci', release: false },
					{ type: 'build', release: false },
					{ type: 'revert', release: 'patch' },
					{ type: 'feat', scope: 'breaking', release: 'major' },
					{ breaking: true, release: 'major' },
				],
				parserOpts: {
					headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/,
					headerCorrespondence: ['type', 'scope', 'subject'],
					notesKeywords: ['BREAKING CHANGE'],
				},
			},
		],
		'@semantic-release/release-notes-generator',
		[
			'@semantic-release/npm',
			{
				npmPublish: false,
				pkgRoot: '.',
			},
		],
		[
			'@semantic-release/exec',
			{
				prepareCmd: 'node scripts/sync-lockfile.js',
			},
		],
		[
			'@semantic-release/git',
			{
				assets: ['package.json', 'pnpm-lock.yaml'],
				message: 'chore(release): ${version} [skip ci]\n\n${notes}\n\n${gitHead}',
				tagFormat: 'v${version}',
			},
		],
		'@semantic-release/github',
	],
};
