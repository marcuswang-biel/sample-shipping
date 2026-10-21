#!/usr/bin/env node
/**
 * Per-worktree Convex setup — idempotent.
 *
 * Follows the official Convex agent-mode → local backend flow:
 *   https://docs.convex.dev/cli/agent-mode
 *   https://docs.convex.dev/cli/local-deployments
 *
 * Non-interactive + no CONVEX_DEPLOY_KEY → CLI provisions a local deployment.
 * CONVEX_AGENT_MODE=anonymous pins the name to "anonymous-agent" and writes
 * CONVEX_DEPLOYMENT=anonymous:anonymous-agent. Linked local deployments use
 * local:… . Client URL is http://127.0.0.1:<port> (not *.convex.cloud).
 *
 * Isolation is the project-local state dir (.convex/local/default/ under the
 * CLI cwd packages/backend/, convex >= 1.32), not the deployment display name.
 *
 * Steps:
 *   1. Refuse to run against a cloud-linked checkout. This script provisions a
 *      LOCAL deployment and would overwrite it.
 *   2. Take a cross-worktree lock. The anonymous backend state under ~/.convex is
 *      shared, so two setups provisioning at once race on its admin key.
 *   3. `convex dev --once` provisions the local backend and writes its URLs to
 *      backend/.env.local. Local data that predates a schema tighten is wiped
 *      and re-provisioned (this worktree's own dev database only).
 *   4. Mirror the Convex URLs into apps/web/.env.local and apps/native/.env.local,
 *      and persist CONVEX_AGENT_MODE=anonymous in backend/.env.local so daily
 *      `pnpm dev` stays non-interactive.
 *   5. Assign this worktree a stable Vite port (first free in 3001-3010, kept
 *      across re-runs; recorded as VITE_DEV_PORT in apps/web/.env.local).
 *   6. Set CONVEX_DEBUG=true (unlocks the dev seed; never set on prod).
 *   7. Auth-specific deployment env (scripts/setup-auth.mjs): trusted origins,
 *      secrets, provider config.
 *   8. `convex run migrations:runAll`, then `convex run init` seeds dev data.
 *
 * After this, `pnpm dev` is the only command developers need.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { configureAuthEnv, describeLogin, PROVISION_ENV } from './setup-auth.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = resolve(ROOT, 'packages/backend');
const BACKEND_ENV = resolve(BACKEND, '.env.local');
const WEB_ENV = resolve(ROOT, 'apps/web/.env.local');
const NATIVE_ENV = resolve(ROOT, 'apps/native/.env.local');
// This worktree's own disposable dev database. Gitignored, per-worktree, never cloud — step 1
// refuses to run against anything that is not `anonymous:` / `local:`, which is what makes
// wiping it safe.
const LOCAL_STATE_DIR = resolve(BACKEND, '.convex/local');
// Any of these can redirect the CLI to a cloud or non-local backend, so setup
// refuses them in env files and strips them from the shell.
const DEPLOY_KEY_ENV_KEYS = [
	'CONVEX_DEPLOY_KEY',
	'CONVEX_DEPLOYMENT_TOKEN',
	'CONVEX_SELF_HOSTED_URL',
	'CONVEX_SELF_HOSTED_ADMIN_KEY',
];
const DEPLOYMENT_SELECTOR_ENV_KEYS = ['CONVEX_DEPLOYMENT', ...DEPLOY_KEY_ENV_KEYS];

const log = (...args) => console.log('  ', ...args);
const step = (msg) => console.log(`\n→ ${msg}`);

function parseEnv(file) {
	const map = new Map();
	if (!existsSync(file)) {
		return map;
	}
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const trimmed = line.trim();
		const eq = trimmed.indexOf('=');
		if (!trimmed || trimmed.startsWith('#') || eq <= 0) {
			continue;
		}
		let value = trimmed.slice(eq + 1).trim();
		const inlineComment = value.indexOf(' #');
		if (inlineComment >= 0) {
			value = value.slice(0, inlineComment).trim();
		}
		map.set(trimmed.slice(0, eq).trim(), value);
	}
	return map;
}

function mergeEnv(file, vars) {
	const lines = (existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n');
	const seen = new Set();
	const out = lines.map((line) => {
		const eq = line.indexOf('=');
		const key = eq > 0 ? line.slice(0, eq).trim() : '';
		if (key in vars) {
			seen.add(key);
			return `${key}=${vars[key]}`;
		}
		return line;
	});
	for (const [key, value] of Object.entries(vars)) {
		if (!seen.has(key)) {
			out.push(`${key}=${value}`);
		}
	}
	writeFileSync(file, `${out.join('\n').replace(/\n+$/, '')}\n`);
}

function convex(args, opts = {}) {
	const env = { ...process.env, CONVEX_AGENT_MODE: 'anonymous' };
	// The worktree's guarded .env.local is the only deployment selector. Shell-level
	// deploy keys must never redirect setup commands to a cloud deployment.
	for (const key of DEPLOYMENT_SELECTOR_ENV_KEYS) {
		delete env[key];
	}
	// Workspace-pinned CLI (packages/backend → convex@catalog), not a registry npx fallback.
	return spawnSync('pnpm', ['exec', 'convex', ...args], {
		cwd: BACKEND,
		encoding: 'utf8',
		env,
		stdio: opts.stdio ?? ['ignore', 'pipe', 'pipe'],
		...opts,
	});
}

function fail(message) {
	console.error(`✗ ${message}`);
	process.exit(1);
}

/** True only for http(s) URLs whose host is loopback — cloud *.convex.cloud must never pass. */
function isLoopbackHttpUrl(raw) {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return false;
		}
		const host = url.hostname.replace(/^\[|\]$/g, '');
		return host === 'localhost' || host === '127.0.0.1' || host === '::1';
	} catch {
		return false;
	}
}

/**
 * Only anonymous (Agent Mode) or linked local backends.
 * Cloud personal/team dev is `dev:…`; prod/preview are also forbidden.
 */
function isLocalOnlyDeployment(deployment) {
	return typeof deployment === 'string' && /^(anonymous|local):/.test(deployment);
}

/**
 * Fail closed before env set / init / migrations.
 *
 * Official CLI writes CONVEX_DEPLOYMENT as `{type}:{name}` via writeDeploymentEnvVar
 * (e.g. anonymous:anonymous-agent under CONVEX_AGENT_MODE=anonymous, or local:…).
 * Cloud personal/team dev is `dev:…`; prod/preview are `prod:` / `preview:`.
 * Client URL for local backends is http://127.0.0.1:<port> (see localDeploymentUrl).
 */
function assertLocalConvexTarget({ deployment, clientUrl, siteUrl }) {
	if (!isLocalOnlyDeployment(deployment)) {
		fail(
			`resolved CONVEX_DEPLOYMENT must be anonymous:… or local:… after provision (got "${deployment || ''}"). ` +
				`Cloud personal/team dev (dev:…), prod, and preview are not allowed for worktree:setup.`,
		);
	}
	for (const [name, value] of [
		['VITE_CONVEX_URL', clientUrl],
		['VITE_CONVEX_SITE_URL', siteUrl],
	]) {
		if (!isLoopbackHttpUrl(value)) {
			fail(
				`${name} must be a loopback http(s) URL (got "${value ?? ''}"); ` +
					`worktree:setup never targets cloud (*.convex.cloud / *.convex.site).`,
			);
		}
	}
}

/**
 * Refuse any pre-existing pointer at cloud personal/team dev (or prod/preview).
 * Worktrees only provision a machine-local backend.
 */
function assertNoCloudPointers(label, envMap) {
	const deployment = envMap.get('CONVEX_DEPLOYMENT') ?? '';
	if (deployment && !isLocalOnlyDeployment(deployment)) {
		fail(
			`${label} has CONVEX_DEPLOYMENT="${deployment}". ` +
				`worktree:setup only allows anonymous:… / local:… — not cloud personal/team dev (dev:…) or prod/preview. ` +
				`Clear that value (or use a clean worktree) and re-run.`,
		);
	}
	for (const key of DEPLOY_KEY_ENV_KEYS) {
		const value = envMap.get(key);
		if (value) {
			fail(
				`${label} has ${key} set. Deploy keys / self-hosted selectors target cloud or non-local backends; ` +
					`worktree:setup refuses them so seed never hits cloud personal/team dev.`,
			);
		}
	}
	for (const key of [
		'VITE_CONVEX_URL',
		'VITE_CONVEX_SITE_URL',
		'CONVEX_URL',
		'CONVEX_SITE_URL',
		'EXPO_PUBLIC_CONVEX_URL',
		'EXPO_PUBLIC_CONVEX_SITE_URL',
	]) {
		const value = envMap.get(key);
		if (value && !isLoopbackHttpUrl(value)) {
			fail(
				`${label} has ${key}=${value} (not loopback / looks like cloud). ` +
					`worktree:setup never uses cloud personal/team dev — remove that URL and re-run.`,
			);
		}
	}
}

step(`Worktree: ${ROOT}`);

step('Guarding against cloud personal/team dev (and other non-local targets)');
const backendEnv = parseEnv(BACKEND_ENV);
const webEnv = parseEnv(WEB_ENV);
const nativeEnv = parseEnv(NATIVE_ENV);
// Shell-level cloud keys: strip for CLI calls, but refuse if they would re-select cloud via file.
assertNoCloudPointers(BACKEND_ENV, backendEnv);
assertNoCloudPointers(WEB_ENV, webEnv);
assertNoCloudPointers(NATIVE_ENV, nativeEnv);
for (const key of DEPLOY_KEY_ENV_KEYS) {
	if (process.env[key]) {
		log(`note: stripping shell ${key} for convex commands (worktree:setup is local-only)`);
	}
}
const deployment = backendEnv.get('CONVEX_DEPLOYMENT') ?? '';
log(
	`✓ ${deployment ? `local-only (${deployment})` : 'unconfigured'} — will not use cloud personal/team dev`,
);

// The header is what the pinned CLI printed when this was reproduced; the per-document detail
// lines are matched too, so a CLI that reports only the detail still recovers. Each is a whole
// CLI sentence rather than a fragment, so an unrelated failure that happens to contain the words
// does not read as stale data.
const STALE_LOCAL_DATA_LINES = [
	/^.*Schema validation failed.*$/im,
	/^.*does not match the schema.*$/im,
	/^.*Object is missing the required field.*$/im,
];

/**
 * `convex dev --once` validates every existing document before it does anything else, so a
 * worktree seeded before a field became required can never reach the reseed that would fix it.
 * The docstring's "stale CONVEX_DEPLOYMENT self-heals" covers a stale pointer, not stale rows.
 *
 * Returns the matched line so the caller can show what it concluded from, not just that it did.
 */
function staleLocalDataEvidence(result) {
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
	for (const pattern of STALE_LOCAL_DATA_LINES) {
		const line = output.match(pattern)?.[0].trim();
		if (line) return line;
	}
	return undefined;
}

/**
 * The anonymous backend state under ~/.convex is shared by every worktree, so two setups
 * provisioning at once race on its admin key: the loser gets through functions, URLs and port
 * assignment and only then dies on `BadAdminKey` at the first env write. Serialising the whole
 * Convex phase is what makes a second worktree wait instead of half-provisioning.
 */
const SHARED_CONVEX_DIR = resolve(homedir(), '.convex');
const SETUP_LOCK = resolve(SHARED_CONVEX_DIR, 'anonymous-worktree-setup.lock');
const LOCK_WAIT_TIMEOUT_MS = 15 * 60 * 1000;

const sleepSync = (ms) => {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/** `kill(pid, 0)` throws EPERM for a live process we do not own — that still counts as alive. */
function isProcessAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === 'EPERM';
	}
}

/**
 * Publishes the lock atomically. The pid goes into a private staging file first and is `link`ed
 * into place, which fails with EEXIST when the lock is taken and never leaves the lock name
 * half-written. `open(path, 'wx')` followed by a separate write does leave that window, and a
 * waiter reading it sees an empty file and concludes the holder is gone.
 */
function tryTakeLock() {
	const staging = `${SETUP_LOCK}.${process.pid}`;
	writeFileSync(staging, `${process.pid}\n`);
	try {
		linkSync(staging, SETUP_LOCK);
		return true;
	} catch (error) {
		if (error.code !== 'EEXIST') throw error;
		return false;
	} finally {
		rmSync(staging, { force: true });
	}
}

/** `'gone'` = released while we looked; `'unreadable'` = present but not a pid. */
function readLockHolder() {
	let raw;
	try {
		raw = readFileSync(SETUP_LOCK, 'utf8');
	} catch (error) {
		if (error.code === 'ENOENT') return 'gone';
		throw error;
	}
	// Whole-string match: `parseInt` would read '123abc' as 123 and hand a corrupted lock back
	// as a valid holder, which is the fallback this path exists to refuse.
	const pid = /^[1-9]\d*$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
	return Number.isInteger(pid) ? pid : 'unreadable';
}

function acquireSetupLock() {
	mkdirSync(SHARED_CONVEX_DIR, { recursive: true });
	const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
	let waitingOn;
	for (;;) {
		if (tryTakeLock()) {
			// Registered only once the lock is ours. Registering it up front would make a timed-out
			// wait delete the lock the *other* setup is still holding. Covers `fail()` too, which
			// exits rather than throwing.
			process.on('exit', () => rmSync(SETUP_LOCK, { force: true }));
			return;
		}

		const holder = readLockHolder();
		if (holder === 'gone') continue;
		if (holder === 'unreadable') {
			// Deleting it would be the one move that can break mutual exclusion outright, so this
			// stops instead and hands the decision to a human.
			fail(
				`${SETUP_LOCK} exists but does not name a process. Check that no other setup is ` +
					`running, then delete it.`,
			);
		}
		if (!isProcessAlive(holder)) {
			// Deliberately not self-healing. Two waiters that both observe the same dead holder
			// would both delete and both take: the second delete removes the lock the first one
			// just published, and mutual exclusion is gone. Re-reading before the delete narrows
			// that window without closing it, because `unlink` cannot be made conditional on the
			// file still being the one that was read. Recovery is a human deleting one file.
			fail(
				`${SETUP_LOCK} is held by pid ${holder}, which is no longer running.\n` +
					`  Check that no other setup is in progress, then remove it and re-run:\n` +
					`      rm ${SETUP_LOCK}`,
			);
		}
		if (waitingOn !== holder) {
			log(`Another worktree setup is provisioning (pid ${holder}); waiting for it to finish…`);
			waitingOn = holder;
		}
		if (Date.now() > deadline) {
			const minutes = Math.round(LOCK_WAIT_TIMEOUT_MS / 60_000);
			fail(
				`Waited ${minutes} minutes for the setup lock held by pid ${holder}. Pids are reused, so if ` +
					`that process is not a worktree setup, remove it and re-run:\n` +
					`      rm ${SETUP_LOCK}`,
			);
		}
		sleepSync(1000);
	}
}

acquireSetupLock();

step('Provisioning local backend (convex dev --once, auto-selects free ports)');
/**
 * Provider config some auth modules read when Convex analyzes `auth.config.ts`. The env set
 * below needs a deployment, and the deployment comes from the first push, so a push that fails
 * on missing provider config gets the defaults written and is retried once.
 */
function seedProvisionEnv() {
	for (const [key, value] of Object.entries(PROVISION_ENV)) {
		const current = convex(['env', 'get', key]);
		if (current.status === 0 && current.stdout.trim()) continue;
		if (convex(['env', 'set', key, value]).status !== 0) return false;
		log(`set placeholder ${key}; replace it with real provider config (see docs/auth.md)`);
	}
	return true;
}

if (convex(['dev', '--once'], { stdio: 'inherit' }).status !== 0) {
	// Rerun captured, to tell stale local data apart from a real failure. A second failure for
	// the same reason is fast; a first failure that was transient just succeeds here.
	if (Object.keys(PROVISION_ENV).length > 0 && !seedProvisionEnv()) {
		fail('could not write placeholder auth env to the new deployment; aborting.');
	}
	const retry = convex(['dev', '--once']);
	const staleData = retry.status === 0 ? undefined : staleLocalDataEvidence(retry);
	if (retry.status === 0) {
		log('✓ succeeded on retry');
	} else if (staleData && isLocalOnlyDeployment(deployment)) {
		log(`Local dev data predates the current schema — resetting ${LOCAL_STATE_DIR}`);
		process.stderr.write(`${staleData}\n`);
		rmSync(LOCAL_STATE_DIR, { recursive: true, force: true });
		if (convex(['dev', '--once'], { stdio: 'inherit' }).status !== 0) {
			fail('convex dev --once still failed after resetting the local dev database; aborting.');
		}
	} else {
		process.stderr.write(retry.stderr ?? '');
		fail('convex dev --once failed; aborting.');
	}
}

step('Mirroring Convex URLs into apps/web and apps/native, pinning anonymous mode for daily dev');
const provisioned = parseEnv(BACKEND_ENV);
const clientUrl = provisioned.get('VITE_CONVEX_URL');
const siteUrl = provisioned.get('VITE_CONVEX_SITE_URL');
const resolvedDeployment = provisioned.get('CONVEX_DEPLOYMENT') ?? '';
if (!clientUrl || !siteUrl) {
	fail(`could not read VITE_CONVEX_URL / VITE_CONVEX_SITE_URL from ${BACKEND_ENV}`);
}
assertLocalConvexTarget({
	deployment: resolvedDeployment,
	clientUrl,
	siteUrl,
});
mergeEnv(WEB_ENV, { VITE_CONVEX_URL: clientUrl, VITE_CONVEX_SITE_URL: siteUrl });
mergeEnv(NATIVE_ENV, { EXPO_PUBLIC_CONVEX_URL: clientUrl, EXPO_PUBLIC_CONVEX_SITE_URL: siteUrl });
mergeEnv(BACKEND_ENV, { CONVEX_AGENT_MODE: 'anonymous' });
log(`✓ ${resolvedDeployment} — ${clientUrl} / ${siteUrl}`);

step('Assigning a stable dev port for this worktree');
const PORT_RANGE_START = 3001;
const PORT_RANGE_END = 3010;
const PORT_LOCK_TIMEOUT_MS = 30_000;

function gitOutput(args) {
	const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
	}
	return result.stdout.trim();
}

function acquirePortLock(lockDir) {
	const startedAt = Date.now();
	for (;;) {
		try {
			mkdirSync(lockDir);
			return;
		} catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
			if (Date.now() - startedAt >= PORT_LOCK_TIMEOUT_MS) {
				throw new Error(
					`timed out waiting for another worktree to assign its dev port; ` +
						`if no setup is running, remove the stale lock at ${lockDir}`,
				);
			}
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
		}
	}
}

function assignDevPort() {
	const commonDir = resolve(ROOT, gitOutput(['rev-parse', '--git-common-dir']));
	const lockDir = resolve(commonDir, 'dev-port.lock');
	acquirePortLock(lockDir);
	try {
		const worktrees = gitOutput(['worktree', 'list', '--porcelain'])
			.split('\n')
			.filter((line) => line.startsWith('worktree '))
			.map((line) => resolve(line.slice('worktree '.length).trim()));
		const mainWorktree = dirname(commonDir);
		const taken = new Set();
		for (const dir of worktrees) {
			if (dir === ROOT) {
				continue;
			}
			const port = Number(parseEnv(resolve(dir, 'apps/web/.env.local')).get('VITE_DEV_PORT'));
			if (Number.isInteger(port) && port >= PORT_RANGE_START && port <= PORT_RANGE_END) {
				taken.add(port);
			} else if (dir === mainWorktree) {
				// The primary checkout predates port markers and owns Vite's default.
				taken.add(PORT_RANGE_START);
			}
		}

		const existing = Number(parseEnv(WEB_ENV).get('VITE_DEV_PORT'));
		let assigned =
			Number.isInteger(existing) &&
			existing >= PORT_RANGE_START &&
			existing <= PORT_RANGE_END &&
			!taken.has(existing)
				? existing
				: undefined;
		for (let port = PORT_RANGE_START; assigned === undefined && port <= PORT_RANGE_END; port++) {
			if (!taken.has(port)) {
				assigned = port;
			}
		}
		if (assigned === undefined) {
			throw new Error(
				`all dev ports ${PORT_RANGE_START}-${PORT_RANGE_END} are claimed by other worktrees; ` +
					'remove one (git worktree remove) or widen the range here (keep SITE_URL below in sync).',
			);
		}
		// Persist the claim before releasing the repo-wide lock.
		mergeEnv(WEB_ENV, { VITE_DEV_PORT: String(assigned) });
		return assigned;
	} finally {
		rmSync(lockDir, { recursive: true, force: true });
	}
}
let devPort;
try {
	devPort = assignDevPort();
} catch (error) {
	fail(error instanceof Error ? error.message : String(error));
}
log(`✓ http://localhost:${devPort} (persisted as VITE_DEV_PORT; strictPort — never drifts)`);

step('Enabling debug features (CONVEX_DEBUG=true — local/dev only)');
if (convex(['env', 'set', 'CONVEX_DEBUG', 'true'], { stdio: 'inherit' }).status !== 0) {
	fail('failed to set CONVEX_DEBUG');
}

step('Configuring auth (scripts/setup-auth.mjs)');
// This worktree's origin first (the canonical auth origin), then every port in the range so
// any worktree's web app passes CORS against this deployment.
const rangeOrigins = [];
for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
	rangeOrigins.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`);
}
const devOrigins = [
	`http://localhost:${devPort}`,
	...rangeOrigins.filter((origin) => origin !== `http://localhost:${devPort}`),
];
configureAuthEnv({ convex, log, fail, devOrigins });

step('Running migrations (convex run migrations:runAll)');
if (convex(['run', 'migrations:runAll'], { stdio: 'inherit' }).status !== 0) {
	fail('migrations:runAll failed');
}

step('Seeding dev data (convex run init)');
if (convex(['run', 'init'], { stdio: 'inherit' }).status !== 0) {
	fail('init failed');
}

console.log(`
✓ Worktree ready.

${describeLogin(devPort)}

  Daily command:  pnpm dev
  Native:         pnpm dev:native   (reads apps/native/.env.local)
`);
