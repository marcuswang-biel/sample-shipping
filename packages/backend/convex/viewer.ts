import { v } from 'convex/values';

import { query } from './_generated/server';

/** The signed-in user as the auth token describes them, or `null` when signed out. */
export const get = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			subject: v.string(),
			email: v.optional(v.string()),
			name: v.optional(v.string()),
		}),
	),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		return {
			subject: identity.subject,
			...(identity.email === undefined ? {} : { email: identity.email }),
			...(identity.name === undefined ? {} : { name: identity.name }),
		};
	},
});
