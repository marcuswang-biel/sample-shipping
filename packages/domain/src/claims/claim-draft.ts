import { Schema, SchemaTransformation } from 'effect';

/** Longest title a claim may carry, after trimming. */
export const CLAIM_TITLE_MAX_LENGTH = 120;

/**
 * A claim as submitted, before any policy runs. Decoding is the validation step:
 * a value of this type has a trimmed, non-empty title and a positive whole number
 * of cents.
 */
export const ClaimDraft = Schema.Struct({
	title: Schema.String.pipe(Schema.decode(SchemaTransformation.trim())).check(
		Schema.isMinLength(1),
		Schema.isMaxLength(CLAIM_TITLE_MAX_LENGTH),
	),
	amountCents: Schema.Int.check(Schema.isGreaterThan(0)),
});

export type ClaimDraft = typeof ClaimDraft.Type;

/** The raw input a caller hands to the rule. Decoding turns it into a `ClaimDraft`. */
export type ClaimRequest = typeof ClaimDraft.Encoded;
