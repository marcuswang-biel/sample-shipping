import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';

import { claimPolicyLayer } from './claim-policy';
import { InvalidClaim, MonthlyQuotaExceeded } from './errors';
import { evaluateClaim } from './evaluate-claim';

const testPolicy = claimPolicyLayer({ autoApproveLimitCents: 1_000, monthlyQuotaCents: 5_000 });

describe('evaluateClaim', () => {
	it.effect('approves a claim within the auto-approve limit', () =>
		Effect.gen(function* () {
			const decision = yield* evaluateClaim({ title: '  Taxi  ', amountCents: 1_000 }, 0);
			expect(decision).toEqual({ title: 'Taxi', amountCents: 1_000, status: 'approved' });
		}).pipe(Effect.provide(testPolicy)),
	);

	it.effect('leaves a claim above the auto-approve limit pending', () =>
		Effect.gen(function* () {
			const decision = yield* evaluateClaim({ title: 'Hotel', amountCents: 1_001 }, 0);
			expect(decision.status).toBe('pending');
		}).pipe(Effect.provide(testPolicy)),
	);

	it.effect('accepts a claim that lands exactly on the monthly quota', () =>
		Effect.gen(function* () {
			const decision = yield* evaluateClaim({ title: 'Flight', amountCents: 2_000 }, 3_000);
			expect(decision.status).toBe('pending');
		}).pipe(Effect.provide(testPolicy)),
	);

	it.effect('fails with MonthlyQuotaExceeded past the quota', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				evaluateClaim({ title: 'Flight', amountCents: 2_001 }, 3_000),
			);
			expect(error).toBeInstanceOf(MonthlyQuotaExceeded);
			expect(error).toMatchObject({
				quotaCents: 5_000,
				monthToDateCents: 3_000,
				requestedCents: 2_001,
			});
		}).pipe(Effect.provide(testPolicy)),
	);

	it.effect('fails with InvalidClaim for a blank title', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(evaluateClaim({ title: '   ', amountCents: 100 }, 0));
			expect(error).toBeInstanceOf(InvalidClaim);
		}).pipe(Effect.provide(testPolicy)),
	);

	it.effect('fails with InvalidClaim for a fractional amount', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(evaluateClaim({ title: 'Lunch', amountCents: 12.5 }, 0));
			expect(error).toBeInstanceOf(InvalidClaim);
		}).pipe(Effect.provide(testPolicy)),
	);
});
