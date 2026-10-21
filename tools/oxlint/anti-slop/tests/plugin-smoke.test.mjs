import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '../../../..');
// `node_modules/oxlint/bin/oxlint` is a JS shim, so running it through `process.execPath`
// behaves the same on every platform. Going through `node_modules/.bin/oxlint` does not:
// that entry is `oxlint.cmd` on Windows, and `execFileSync` without a shell cannot start a
// `.cmd` at all. The catch below would not help either — a spawn failure carries no stdout.
const oxlintEntry = path.join(repositoryRoot, 'node_modules/oxlint/bin/oxlint');
const runOxlint = (args) =>
	execFileSync(process.execPath, [oxlintEntry, ...args], {
		cwd: repositoryRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
const plugin = path.join(repositoryRoot, 'tools/oxlint/anti-slop/index.ts');

test('loads the vendored plugin and runs every retained rule through Oxlint', async (context) => {
	const directory = await mkdtemp(path.join(tmpdir(), 'anti-slop-plugin-smoke-'));
	context.after(async () => {
		await rm(directory, { force: true, recursive: true });
	});
	const config = path.join(directory, '.oxlintrc.json');
	const fixture = path.join(directory, 'fixture.ts');
	const retainedRules = [
		'no-chained-type-assertions',
		'no-known-value-widening',
		'no-module-mocking',
		'no-object-parameters',
		'no-reflect-apply',
		'no-reflect-get',
		'no-runtime-typeof',
		'no-shape-in-symbol-names',
		'no-unknown-parameters',
		'no-unknown-returns',
		'no-unknown-type-aliases',
		'no-unsafe-dictionary-type',
		'no-widen-then-assert',
		'require-safety-comment-for-type-assertion',
	];

	await writeFile(
		config,
		JSON.stringify({
			jsPlugins: [{ name: 'anti-slop', specifier: plugin }],
			rules: Object.fromEntries(retainedRules.map((rule) => [`anti-slop/${rule}`, 'error'])),
		}),
	);
	await writeFile(
		fixture,
		`const chained = (input as unknown) as { readonly id: string };
function acceptsObject(value: object) {}
Reflect.apply(operation, owner, args);
vi.mock('./dependency');
Reflect.get(owner, key);
try { run(); } catch (error) { use(typeof error); }
const shapedRows = rows;
function returnsUnknown(): unknown { return input; }
type SaveHandler = (value: unknown) => void;
type HiddenUnknown = unknown;
type Payload = Record<string, unknown>;
const source = { id: 'invoice' };
const widened: unknown = source;
const parsed = widened as { readonly id: string };
const labels: Record<string, string> = { draft: 'Draft' };
`,
	);

	let output;
	try {
		output = runOxlint(['--config', config, '--format', 'json', fixture]);
	} catch (error) {
		if (!(error instanceof Error) || !('stdout' in error) || error.stdout === undefined)
			throw error;
		output = String(error.stdout);
	}

	const diagnostics = JSON.parse(output).diagnostics;
	assert.deepEqual(
		new Set(
			diagnostics
				.filter((diagnostic) => diagnostic.code.startsWith('anti-slop('))
				.map((diagnostic) => diagnostic.code),
		),
		new Set(retainedRules.map((rule) => `anti-slop(${rule})`)),
	);
});

/**
 * Oxlint reuses createOnce instances across files. The lexical resolver must replace its
 * environment at Program entry; neither aliases nor diagnostics may escape into a clean file.
 * RuleTester lints one file per case, so this needs one real multi-file Oxlint invocation.
 */
test('does not carry rule state from one file into the next', async (context) => {
	const directory = await mkdtemp(path.join(tmpdir(), 'anti-slop-cross-file-'));
	context.after(async () => {
		await rm(directory, { force: true, recursive: true });
	});
	const leakyRules = ['no-object-parameters', 'no-unknown-returns', 'no-unknown-type-aliases'];
	const config = path.join(directory, '.oxlintrc.json');
	const dirty = path.join(directory, 'a-dirty.ts');
	const clean = path.join(directory, 'b-clean.ts');

	await writeFile(
		config,
		JSON.stringify({
			jsPlugins: [{ name: 'anti-slop', specifier: plugin }],
			rules: Object.fromEntries(leakyRules.map((rule) => [`anti-slop/${rule}`, 'error'])),
		}),
	);
	await writeFile(
		dirty,
		`export function acceptsObject(value: object) { return value; }
export function returnsUnknown(): unknown { return 1; }
export type HiddenUnknown = unknown;
`,
	);
	// Nothing here violates any of the three rules.
	await writeFile(
		clean,
		`export type Named = { readonly id: string };
export function acceptsNamed(value: Named): string { return value.id; }
`,
	);

	let output;
	try {
		output = runOxlint(['--config', config, '--format', 'json', dirty, clean]);
	} catch (error) {
		if (!(error instanceof Error) || !('stdout' in error) || error.stdout === undefined)
			throw error;
		output = String(error.stdout);
	}

	const antiSlop = JSON.parse(output).diagnostics.filter((diagnostic) =>
		diagnostic.code.startsWith('anti-slop('),
	);
	const inClean = antiSlop.filter((diagnostic) =>
		(diagnostic.filename ?? '').endsWith('b-clean.ts'),
	);
	assert.deepEqual(
		inClean,
		[],
		`the clean file must report nothing; got ${JSON.stringify(inClean)}`,
	);
	assert.equal(antiSlop.length, 3, 'the dirty file still reports one finding per rule');
});
