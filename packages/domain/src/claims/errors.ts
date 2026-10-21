import { Schema } from 'effect';

/** The submitted claim failed validation (empty title, non-positive amount, …). */
export class InvalidClaim extends Schema.TaggedErrorClass<InvalidClaim>()('InvalidClaim', {
	reason: Schema.String,
}) {}

/** Accepting the claim would push the owner past this month's quota. */
export class MonthlyQuotaExceeded extends Schema.TaggedErrorClass<MonthlyQuotaExceeded>()(
	'MonthlyQuotaExceeded',
	{
		quotaCents: Schema.Number,
		monthToDateCents: Schema.Number,
		requestedCents: Schema.Number,
	},
) {}

export type ClaimError = InvalidClaim | MonthlyQuotaExceeded;
