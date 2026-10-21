import { APP_ERROR_CODES, type AppErrorData } from '@acme/shared/error-codes';
import { ConvexError } from 'convex/values';

import type { QueryCtx } from '../_generated/server';

/**
 * The signed-in user's stable id: the `sub` claim of the token Convex validated.
 * Use it as the owner key on rows. It is the same for every auth provider this
 * template supports, so domain tables never depend on the auth library.
 */
export async function requireUserId(ctx: Pick<QueryCtx, 'auth'>): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new ConvexError<AppErrorData>({
			code: APP_ERROR_CODES.unauthenticated,
			message: 'Sign in to continue.',
		});
	}
	return identity.subject;
}
