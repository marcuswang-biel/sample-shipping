import { Layer, ServiceMap } from 'effect';

/** Limits the claim rule reads. Supplied through a Layer so tests and tenants can swap them. */
export type ClaimLimits = {
	/** Claims at or below this amount are approved without review. */
	readonly autoApproveLimitCents: number;
	/** Sum of one owner's claims in a calendar month (UTC) may not exceed this. */
	readonly monthlyQuotaCents: number;
};

export class ClaimPolicy extends ServiceMap.Service<ClaimPolicy, ClaimLimits>()(
	'@acme/domain/ClaimPolicy',
) {}

export const DEFAULT_CLAIM_POLICY: ClaimLimits = {
	autoApproveLimitCents: 50_000,
	monthlyQuotaCents: 500_000,
};

/** Builds a policy layer from explicit limits. */
export const claimPolicyLayer = (policy: ClaimLimits) => Layer.succeed(ClaimPolicy)(policy);

/** The production policy. */
export const ClaimPolicyLive = claimPolicyLayer(DEFAULT_CLAIM_POLICY);
