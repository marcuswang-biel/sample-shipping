import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Stored claim status. English codes; clients translate the label. */
export const claimStatusValidator = v.union(v.literal('approved'), v.literal('pending'));

export default defineSchema({
	/**
	 * Example table. One row per expense claim. `ownerId` is the auth subject
	 * (`ctx.auth.getUserIdentity().subject`), so every read and write is scoped by it.
	 * Delete this table, `claims.ts` and `packages/domain/src/claims` when you start
	 * your own domain.
	 */
	claims: defineTable({
		ownerId: v.string(),
		title: v.string(),
		amountCents: v.number(),
		status: claimStatusValidator,
		createdAt: v.number(),
	}).index('by_owner_and_createdAt', ['ownerId', 'createdAt']),
});
