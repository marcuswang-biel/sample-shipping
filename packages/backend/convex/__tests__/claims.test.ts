// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexErrorCode } from '@acme/shared/convex-error';
import { APP_ERROR_CODES } from '@acme/shared/error-codes';
import { describe, expect, it } from 'vitest';

import { convexTest, signIn } from '../../test/harness';
import { api } from '../_generated/api';
import { startOfUtcMonth } from '../claims';
import schema from '../schema';

const modules = import.meta.glob(['../**/*.ts', '../**/*.js', '!../**/*.d.ts', '!../**/*.test.ts']);

async function codeOf(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		return convexErrorCode(error);
	}
	throw new Error('expected the call to fail');
}

describe('claims', () => {
	it('rejects anonymous callers', async () => {
		const t = convexTest(schema, modules);
		expect(await codeOf(t.query(api.claims.listMine, {}))).toBe(APP_ERROR_CODES.unauthenticated);
		expect(await codeOf(t.mutation(api.claims.submit, { title: 'Taxi', amountCents: 100 }))).toBe(
			APP_ERROR_CODES.unauthenticated,
		);
	});

	it('approves a small claim and lists it for its owner only', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const bob = await signIn(t, 'bob@example.com');

		const result = await alice.as.mutation(api.claims.submit, {
			title: '  Taxi  ',
			amountCents: 12_000,
		});

		expect(result.status).toBe('approved');
		const mine = await alice.as.query(api.claims.listMine, {});
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ title: 'Taxi', ownerId: alice.userId, status: 'approved' });
		expect(await bob.as.query(api.claims.listMine, {})).toEqual([]);
	});

	it('leaves a claim above the auto-approve limit pending', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');

		const result = await alice.as.mutation(api.claims.submit, {
			title: 'Hotel',
			amountCents: 60_000,
		});

		expect(result.status).toBe('pending');
	});

	it('maps InvalidClaim to CLAIM_INVALID and writes nothing', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');

		expect(
			await codeOf(alice.as.mutation(api.claims.submit, { title: ' ', amountCents: 100 })),
		).toBe(APP_ERROR_CODES.claimInvalid);
		expect(await alice.as.query(api.claims.listMine, {})).toEqual([]);
	});

	it('maps MonthlyQuotaExceeded to CLAIM_MONTHLY_QUOTA_EXCEEDED using this month only', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const lastMonth = startOfUtcMonth(Date.now()) - 1;
		await t.run(async (ctx) => {
			// Last month's spend does not count toward this month's quota.
			await ctx.db.insert('claims', {
				ownerId: alice.userId,
				title: 'Old',
				amountCents: 499_000,
				status: 'pending',
				createdAt: lastMonth,
			});
			await ctx.db.insert('claims', {
				ownerId: alice.userId,
				title: 'Earlier this month',
				amountCents: 450_000,
				status: 'pending',
				createdAt: Date.now(),
			});
		});

		expect(
			await codeOf(alice.as.mutation(api.claims.submit, { title: 'Flight', amountCents: 50_001 })),
		).toBe(APP_ERROR_CODES.claimMonthlyQuotaExceeded);
		const accepted = await alice.as.mutation(api.claims.submit, {
			title: 'Train',
			amountCents: 50_000,
		});
		expect(accepted.status).toBe('approved');
	});

	it("does not let a user delete another user's claim", async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const bob = await signIn(t, 'bob@example.com');
		const { claimId } = await alice.as.mutation(api.claims.submit, {
			title: 'Taxi',
			amountCents: 100,
		});

		expect(await codeOf(bob.as.mutation(api.claims.remove, { claimId }))).toBe(
			APP_ERROR_CODES.notFound,
		);
		await alice.as.mutation(api.claims.remove, { claimId });
		expect(await alice.as.query(api.claims.listMine, {})).toEqual([]);
	});
});

describe('viewer', () => {
	it('returns null when signed out and the token claims when signed in', async () => {
		const t = convexTest(schema, modules);
		expect(await t.query(api.viewer.get, {})).toBeNull();
		const alice = await signIn(t, 'alice@example.com');
		expect(await alice.as.query(api.viewer.get, {})).toMatchObject({
			subject: alice.userId,
			email: 'alice@example.com',
		});
	});
});
