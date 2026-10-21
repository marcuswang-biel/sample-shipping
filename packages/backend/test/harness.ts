/**
 * `convexTest` with this backend's components pre-registered, plus a real sign-in.
 *
 * Outside `convex/` on purpose: the deployment analyzer parses every file under it,
 * and the component test entrypoints imported below use `import.meta`, which it
 * rejects.
 */

import type { TestConvex } from 'convex-test';

import { register as registerBetterAuth } from '@convex-dev/better-auth/test';
import { register as registerMigrations } from '@convex-dev/migrations/test';
import { convexTest as convexTestRaw } from 'convex-test';

import type backendSchema from '../convex/schema';

import { components } from '../convex/_generated/api';

/**
 * Not generic on purpose: naming the one schema this harness is ever given keeps
 * `ctx.db.insert` strictly typed in tests (a generic harness hands tests the loose
 * data model, where any field is accepted).
 */
export const convexTest = (
	schema: typeof backendSchema,
	modules: Record<string, () => Promise<unknown>>,
): TestConvex<typeof backendSchema> => {
	// SAFETY: convexTest's declared return uses a `boolean` strictness flag; this
	// harness is only ever handed the backend's own strict schema.
	const t = convexTestRaw(schema, modules) as unknown as TestConvex<typeof backendSchema>;
	// SAFETY: the registration helpers are typed against a generic schema.
	const target = t as unknown as Parameters<typeof registerMigrations>[0];
	registerBetterAuth(target);
	registerMigrations(target);
	return t;
};

/**
 * Create a real Better Auth user and session, then return a client acting as them.
 * The identity's `subject` is the Better Auth user id, as in production.
 */
export async function signIn(t: TestConvex<typeof backendSchema>, email: string) {
	const now = Date.now();
	const user = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'user',
			data: {
				name: email.split('@')[0],
				email,
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			},
		},
	});
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				userId: user._id,
				token: email,
				expiresAt: now + 3_600_000,
				createdAt: now,
				updatedAt: now,
			},
		},
	});
	return {
		as: t.withIdentity({ subject: user._id, sessionId: session._id, email }),
		userId: user._id,
	};
}
