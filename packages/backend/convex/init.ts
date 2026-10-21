/**
 * Dev seed — idempotent.
 *
 * Ensures the dev user exists (and owns a couple of example claims) so a fresh
 * worktree can sign in immediately.
 *
 * Convex pattern (https://stack.convex.dev/seeding-data-for-preview-deployments):
 *   - Default export named `init`, so `convex run init` and `convex dev --run init` find it
 *   - Internal: the CLI can run it, clients cannot
 *   - Idempotent: safe to call on every `pnpm dev`
 *   - A no-op unless CONVEX_DEBUG=true, which only `worktree:setup` sets on a local backend
 */
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

type SeedResult = { status: 'seeded' | 'skipped'; email: string | null };

export default internalAction({
	args: {},
	returns: v.object({
		status: v.union(v.literal('seeded'), v.literal('skipped')),
		email: v.union(v.string(), v.null()),
	}),
	handler: async (ctx): Promise<SeedResult> => {
		if (process.env.CONVEX_DEBUG !== 'true') {
			return { status: 'skipped', email: null };
		}
		const user = await ctx.runAction(internal.auth.ensureDevUserInternal, {});
		return { status: 'seeded', email: user.email };
	},
});
