/**
 * Auth-specific part of `pnpm worktree:setup` (Better Auth).
 *
 * This file and the other auth files differ between the better-auth and logto
 * templates; scripts/setup-worktree.mjs is identical in both.
 */
import { randomBytes } from 'node:crypto';

/** Deployment env `auth.config.ts` needs before the first push. Better Auth needs none. */
export const PROVISION_ENV = {};

/**
 * @param {object} options
 * @param {(args: string[], opts?: object) => import('node:child_process').SpawnSyncReturns<string>} options.convex
 * @param {(...args: unknown[]) => void} options.log
 * @param {(message: string) => never} options.fail
 * @param {string[]} options.devOrigins This worktree's origin first, then the rest of the range.
 */
export function configureAuthEnv({ convex, log, fail, devOrigins }) {
	// First entry = this worktree's canonical Better Auth origin (crossDomain).
	if (convex(['env', 'set', 'SITE_URL', devOrigins.join(',')], { stdio: 'inherit' }).status !== 0) {
		fail('failed to set SITE_URL');
	}
	log(`✓ SITE_URL trusts ${devOrigins.length} local origins (${devOrigins[0]} canonical)`);

	const secret = convex(['env', 'get', 'BETTER_AUTH_SECRET']);
	if (secret.status === 0 && secret.stdout.trim().length > 0) {
		log('✓ BETTER_AUTH_SECRET already set, kept');
	} else {
		const generated = randomBytes(32).toString('hex');
		if (
			convex(['env', 'set', 'BETTER_AUTH_SECRET', generated], { stdio: 'inherit' }).status !== 0
		) {
			fail('failed to set BETTER_AUTH_SECRET');
		}
		log('✓ BETTER_AUTH_SECRET generated and set');
	}
}

/** Printed when setup finishes. */
export function describeLogin(devPort) {
	return `  Sign in at http://localhost:${devPort}/sign-in (this worktree's fixed port):
    Email:    dev@example.com
    Password: devpassword`;
}
