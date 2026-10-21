import { ConvexError, type Value } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { convexErrorCode, convexErrorMessage } from './convex-error';

/**
 * What the client throws after a production deployment redacts the message. A development
 * deployment leaves the real text in `message`, so a test that lets the two agree passes against
 * the bug this helper exists to fix.
 */
function redacted(data: Value): Error {
	const error = new Error(
		'[CONVEX M(claims:submit)] [Request ID: 4a2360b4a67b0354] Server Error\n  Called by client',
	);
	return Object.assign(error, { data });
}

describe('convexErrorMessage', () => {
	it('reads the message from structured application data', () => {
		expect(
			convexErrorMessage(new ConvexError({ code: 'NOT_FOUND', message: 'Gone' }), 'Failed'),
		).toBe('Gone');
	});

	it('reads data from a redacted production error', () => {
		expect(convexErrorMessage(redacted({ code: 'NOT_FOUND', message: 'Gone' }), 'Failed')).toBe(
			'Gone',
		);
	});

	it('falls back when a redacted error carries no data', () => {
		expect(convexErrorMessage(redacted(null), 'Failed')).toBe('Failed');
	});
});

describe('convexErrorCode', () => {
	it('reads the code from application data', () => {
		expect(convexErrorCode(redacted({ code: 'CLAIM_INVALID', message: 'x' }))).toBe(
			'CLAIM_INVALID',
		);
	});

	it('returns null for an error without a code', () => {
		expect(convexErrorCode(new Error('boom'))).toBeNull();
	});
});
