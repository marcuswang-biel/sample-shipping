#!/usr/bin/env node
/**
 * Checks that the committed `convex/_generated/api.d.ts` still lists exactly the modules that
 * are on disk.
 *
 * `convex codegen` needs a live deployment (it uploads the functions first), so CI cannot
 * regenerate the file. But the part that actually goes stale — the import manifest at the top
 * of `api.d.ts` — is derivable from the filesystem alone, using the same entry-point rules the
 * Convex bundler applies (`convex/dist/cjs/bundler/index.js`, `entryPoints`).
 *
 * This catches both directions:
 *   - a module deleted while its import survives, which `tsc --skipLibCheck` does not flag;
 *   - a module added by someone without a configured deployment, which nothing flagged at all.
 *
 * It does not check the `FunctionReference` bodies. Those only drift when a function's args or
 * return type change, which typechecking does catch at the call site.
 *
 * Usage: node scripts/verify-convex-codegen.mjs <convex-dir>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import process from 'node:process';

const ENTRY_POINT_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.jsx'];

const convexDir = process.argv[2];
if (!convexDir) {
	console.error('Usage: node scripts/verify-convex-codegen.mjs <convex-dir>');
	process.exit(1);
}

const exists = (path) => {
	try {
		statSync(path);
		return true;
	} catch {
		return false;
	}
};

/** Mirrors the bundler's `entryPoints` walk. Keep the order of the checks aligned with it. */
const collectEntryPoints = (dir, out = []) => {
	for (const name of readdirSync(dir).sort()) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			// A directory holding its own convex.config.ts is a component, bundled separately.
			if (!exists(join(path, 'convex.config.ts'))) collectEntryPoints(path, out);
			continue;
		}
		const relPath = relative(convexDir, path);
		if (!ENTRY_POINT_EXTENSIONS.some((ext) => relPath.endsWith(ext))) continue;
		if (relPath.startsWith(`_generated${sep}`)) continue;
		if (name.startsWith('.') || name.startsWith('#')) continue;
		if (name === 'schema.ts' || name === 'schema.js') continue;
		// Excludes *.test.ts, *.fixture.ts, auth.config.ts, convex.config.ts …
		if ((name.match(/\./g) ?? []).length > 1) continue;
		if (relPath.includes(' ')) continue;
		// A file with no top-level import/export is not a module the bundler will take.
		if (/\.tsx?$/.test(name) && !/^\s{0,100}(import|export)/m.test(readFileSync(path, 'utf8')))
			continue;
		out.push(relPath.replaceAll(sep, '/').replace(/\.[^.]+$/, ''));
	}
	return out;
};

const apiPath = join(convexDir, '_generated', 'api.d.ts');
const declared = new Set(
	[
		...readFileSync(apiPath, 'utf8').matchAll(/^import type \* as \S+ from "\.\.\/(.+?)\.js";$/gm),
	].map((match) => match[1]),
);
const onDisk = new Set(collectEntryPoints(convexDir));

const dangling = [...declared].filter((module) => !onDisk.has(module)).sort();
const missing = [...onDisk].filter((module) => !declared.has(module)).sort();

if (dangling.length === 0 && missing.length === 0) {
	console.log(`Verified ${onDisk.size} Convex modules against ${relative('.', apiPath)}.`);
	process.exit(0);
}

console.error(
	`${relative('.', apiPath)} is out of date. Run \`npx convex codegen\` and commit it.`,
);
for (const module of dangling) console.error(`  imported but deleted: ${module}`);
for (const module of missing) console.error(`  on disk but not imported: ${module}`);
process.exit(1);
