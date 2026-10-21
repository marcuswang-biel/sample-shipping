/**
 * Example feature: expense claims.
 *
 * This file is the boundary between Convex and the business rule. The pattern
 * (ADR 0001):
 *
 *   1. authorize (owner = auth subject),
 *   2. read whatever the rule needs from `ctx.db`,
 *   3. run the Effect program from `@acme/domain` and map its tagged errors to
 *      `ConvexError` codes,
 *   4. write the decision.
 *
 * The rule itself lives in `packages/domain/src/claims` and never imports Convex.
 */
import { ClaimPolicyLive, evaluateClaim, type ClaimError } from '@acme/domain/claims';
import { APP_ERROR_CODES, type AppErrorData } from '@acme/shared/error-codes';
import { ConvexError, v } from 'convex/values';
import { Cause, Effect, Exit } from 'effect';

import type { QueryCtx } from './_generated/server';

import { query } from './_generated/server';
import { internalMutation, mutation } from './functions';
import { requireUserId } from './lib/identity';
import { claimStatusValidator } from './schema';

const claimValidator = v.object({
	_id: v.id('claims'),
	_creationTime: v.number(),
	ownerId: v.string(),
	title: v.string(),
	amountCents: v.number(),
	status: claimStatusValidator,
	createdAt: v.number(),
});

/** First millisecond of the UTC calendar month containing `now`. */
export function startOfUtcMonth(now: number): number {
	const date = new Date(now);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

async function monthToDateCents(ctx: QueryCtx, ownerId: string, now: number): Promise<number> {
	const claims = await ctx.db
		.query('claims')
		.withIndex('by_owner_and_createdAt', (q) =>
			q.eq('ownerId', ownerId).gte('createdAt', startOfUtcMonth(now)),
		)
		.collect();
	return claims.reduce((total, claim) => total + claim.amountCents, 0);
}

function toConvexError(error: ClaimError): ConvexError<AppErrorData> {
	switch (error._tag) {
		case 'InvalidClaim':
			return new ConvexError({ code: APP_ERROR_CODES.claimInvalid, message: error.reason });
		case 'MonthlyQuotaExceeded':
			return new ConvexError({
				code: APP_ERROR_CODES.claimMonthlyQuotaExceeded,
				message: `Monthly quota of ${error.quotaCents} cents would be exceeded.`,
			});
	}
}

/** The signed-in user's claims, newest first. */
export const listMine = query({
	args: {},
	returns: v.array(claimValidator),
	handler: async (ctx) => {
		const ownerId = await requireUserId(ctx);
		return await ctx.db
			.query('claims')
			.withIndex('by_owner_and_createdAt', (q) => q.eq('ownerId', ownerId))
			.order('desc')
			.take(100);
	},
});

/** Submit a claim. The domain rule decides whether it is approved, pending, or rejected. */
export const submit = mutation({
	args: { title: v.string(), amountCents: v.number() },
	returns: v.object({ claimId: v.id('claims'), status: claimStatusValidator }),
	handler: async (ctx, args) => {
		const ownerId = await requireUserId(ctx);
		const now = Date.now();
		const spent = await monthToDateCents(ctx, ownerId, now);

		const exit = await Effect.runPromiseExit(
			evaluateClaim(args, spent).pipe(Effect.provide(ClaimPolicyLive)),
		);
		if (Exit.isFailure(exit)) {
			const failure = Cause.findErrorOption(exit.cause);
			if (failure._tag === 'Some') throw toConvexError(failure.value);
			// A defect (a bug in the rule, not a business outcome). Let Convex report it.
			throw Cause.squash(exit.cause);
		}

		const decision = exit.value;
		const claimId = await ctx.db.insert('claims', {
			ownerId,
			title: decision.title,
			amountCents: decision.amountCents,
			status: decision.status,
			createdAt: now,
		});
		return { claimId, status: decision.status };
	},
});

/** Delete one of your own claims. Another user's claim id reads as not found. */
export const remove = mutation({
	args: { claimId: v.id('claims') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const ownerId = await requireUserId(ctx);
		const claim = await ctx.db.get('claims', args.claimId);
		if (!claim || claim.ownerId !== ownerId) {
			throw new ConvexError<AppErrorData>({
				code: APP_ERROR_CODES.notFound,
				message: 'Claim not found.',
			});
		}
		await ctx.db.delete('claims', args.claimId);
		return null;
	},
});

/** Dev seed: a couple of claims for a user, skipped when they already have some. */
export const seedForOwner = internalMutation({
	args: { ownerId: v.string() },
	returns: v.number(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('claims')
			.withIndex('by_owner_and_createdAt', (q) => q.eq('ownerId', args.ownerId))
			.first();
		if (existing) return 0;
		const now = Date.now();
		await ctx.db.insert('claims', {
			ownerId: args.ownerId,
			title: 'Taxi to airport',
			amountCents: 18_000,
			status: 'approved',
			createdAt: now,
		});
		await ctx.db.insert('claims', {
			ownerId: args.ownerId,
			title: 'Client dinner',
			amountCents: 86_000,
			status: 'pending',
			createdAt: now,
		});
		return 2;
	},
});
