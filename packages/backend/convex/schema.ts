import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Stored claim status. English codes; clients translate the label. */
export const claimStatusValidator = v.union(v.literal('approved'), v.literal('pending'));

/** Stored shipment status. English codes; clients translate the label. */
export const shipmentStatusValidator = v.union(
	v.literal('draft'),
	v.literal('shipped'),
	v.literal('received'),
);

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

	/**
	 * One row per sample shipment. `ownerId` is the auth subject of the person who
	 * registered it. Any signed-in user may list rows whose status is `shipped`.
	 */
	shipments: defineTable({
		ownerId: v.string(),
		title: v.string(),
		recipientName: v.string(),
		trackingNumber: v.union(v.string(), v.null()),
		status: shipmentStatusValidator,
		createdAt: v.number(),
	})
		.index('by_owner_and_createdAt', ['ownerId', 'createdAt'])
		.index('by_status_and_createdAt', ['status', 'createdAt']),
});
