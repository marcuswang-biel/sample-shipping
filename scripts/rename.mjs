#!/usr/bin/env node
/**
 * Renames the template's placeholder identity in every tracked text file.
 *
 *   node scripts/rename.mjs <slug> [display name]
 *   node scripts/rename.mjs billing "Billing Portal"
 *
 * Replaces, word-bounded:
 *   acme  → <slug>          (npm scope @acme/*, Expo slug/scheme, bundle id com.acme.app,
 *                            storage keys, NATIVE_APP_SCHEME default)
 *   Acme  → <display name>  (page titles, app name; defaults to the slug)
 *
 * Then run `pnpm install` to rewrite the lockfile, and re-run `pnpm worktree:setup`
 * if the native scheme changed. Run it once, on a clean git tree, so `git diff`
 * shows exactly what it touched.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [slug, displayName = slug] = process.argv.slice(2);

if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
	console.error('Usage: node scripts/rename.mjs <slug> [display name]');
	console.error('  <slug>: lowercase letters, digits and dashes, starting with a letter');
	process.exit(1);
}

const SKIP = [/^pnpm-lock\.yaml$/, /\.(png|jpg|ico|otf|ttf|woff2?)$/, /^scripts\/rename\.mjs$/];
// Bundle ids and Android packages cannot contain dashes.
const bundleSegment = slug.replaceAll('-', '');

const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
	.split('\n')
	.filter((file) => file && !SKIP.some((pattern) => pattern.test(file)));

let changed = 0;
for (const file of files) {
	const path = resolve(ROOT, file);
	const before = readFileSync(path, 'utf8');
	const after = before
		.replaceAll('com.acme.app', `com.${bundleSegment}.app`)
		.replace(/\bacme\b/g, slug)
		.replace(/\bAcme\b/g, displayName);
	if (after !== before) {
		writeFileSync(path, after);
		changed += 1;
		console.log(`  ${file}`);
	}
}

console.log(`\n✓ Renamed acme → ${slug} ("${displayName}") in ${changed} files.`);
console.log('  Next: pnpm install && pnpm check');
