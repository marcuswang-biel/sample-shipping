/**
 * Production deployments redact a failed call's `errorMessage` to `Server Error` and keep the
 * thrown value in `data` — upstream's wording is "Application errors in production still include
 * custom data". Reading `.message` therefore shows every user a placeholder while the reason sits
 * one property away, and development does not redact, so that mistake looks correct locally and
 * only surfaces once shipped.
 */

/** Convex's client wrapper: `[CONVEX M(path)] {message}\n  Called by client`. */
const CONVEX_ENVELOPE = /^\[CONVEX [^\]]*\]\s*/;
const REQUEST_ID = /^\[Request ID: [^\]]*\]\s*/;
const CALLED_BY_CLIENT = /\s*Called by client\s*$/;

/** What a redacted deployment puts where the message was. */
const REDACTED = 'Server Error';

/**
 * `instanceof ConvexError` is deliberately not used: it compares against whichever copy of the
 * `convex` package the caller bundled, and a duplicate in the graph makes it silently false. The
 * property is the contract.
 */
function errorData(error: unknown): unknown {
	if (typeof error !== 'object' || error === null || !('data' in error)) return undefined;
	return error.data;
}

/** Stable string-valued application error code carried in `ConvexError.data`. */
export function convexErrorCode(error: unknown): string | null {
	const data = errorData(error);
	if (typeof data !== 'object' || data === null || !('code' in data)) return null;
	return typeof data.code === 'string' && data.code.trim() ? data.code.trim() : null;
}

function unwrapEnvelope(message: string): string {
	return message
		.replace(CONVEX_ENVELOPE, '')
		.replace(REQUEST_ID, '')
		.replace(CALLED_BY_CLIENT, '')
		.trim();
}

/**
 * The text to show a user for a failed Convex call.
 *
 * `fallback` covers the cases with nothing to show: a redacted message with no application data
 * (the function threw something that was not a `ConvexError`), and data that carries no display
 * string — a migration dry run throws `{ kind: 'DRY RUN', result }`, which is for a CLI operator
 * and would be noise in a toast.
 */
export function convexErrorMessage(error: unknown, fallback: string): string {
	const data = errorData(error);
	if (typeof data === 'string' && data.trim()) return data;
	if (typeof data === 'object' && data !== null && 'message' in data) {
		const message = data.message;
		if (typeof message === 'string' && message.trim()) return message;
	}
	if (error instanceof Error) {
		const message = unwrapEnvelope(error.message);
		if (message && message !== REDACTED) return message;
	}
	return fallback;
}
