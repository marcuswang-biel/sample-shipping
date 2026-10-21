import { Effect, Schema } from 'effect';

import { ClaimDraft, type ClaimRequest } from './claim-draft';
import { ClaimPolicy } from './claim-policy';
import { InvalidClaim, MonthlyQuotaExceeded } from './errors';

export type ClaimStatus = 'approved' | 'pending';

export type ClaimDecision = ClaimDraft & {
	readonly status: ClaimStatus;
};

/**
 * The claim rule.
 *
 * 1. Decode the request; a malformed one fails with `InvalidClaim`.
 * 2. Reject it with `MonthlyQuotaExceeded` when it would push the owner's
 *    month-to-date total past the quota.
 * 3. Otherwise approve it when it is within the auto-approve limit, or leave it
 *    pending for review.
 *
 * The caller reads `monthToDateCents` from storage and writes the decision back.
 * This function never touches a database.
 */
export const evaluateClaim = (request: ClaimRequest, monthToDateCents: number) =>
	Effect.gen(function* () {
		const draft = yield* Schema.decodeEffect(ClaimDraft)(request).pipe(
			Effect.mapError((error) => new InvalidClaim({ reason: error.message })),
		);
		const policy = yield* ClaimPolicy;

		if (monthToDateCents + draft.amountCents > policy.monthlyQuotaCents) {
			return yield* new MonthlyQuotaExceeded({
				quotaCents: policy.monthlyQuotaCents,
				monthToDateCents,
				requestedCents: draft.amountCents,
			});
		}

		const status: ClaimStatus =
			draft.amountCents <= policy.autoApproveLimitCents ? 'approved' : 'pending';
		const decision: ClaimDecision = { ...draft, status };
		return decision;
	});
