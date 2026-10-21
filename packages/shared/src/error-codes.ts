/**
 * Stable application error codes carried in `ConvexError.data.code`.
 *
 * Clients branch on the code, never on the message: production deployments redact
 * `error.message`, and messages are translated. Add a code here before throwing it.
 */
export const APP_ERROR_CODES = {
	unauthenticated: 'UNAUTHENTICATED',
	notFound: 'NOT_FOUND',
	claimInvalid: 'CLAIM_INVALID',
	claimMonthlyQuotaExceeded: 'CLAIM_MONTHLY_QUOTA_EXCEEDED',
} as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES];

/** Shape of `ConvexError.data` thrown by this backend. */
export type AppErrorData = {
	code: AppErrorCode;
	message: string;
};

const KNOWN_CODES: ReadonlySet<string> = new Set(Object.values(APP_ERROR_CODES));

/** Narrows a code read off an error (`convexErrorCode`) to one this app defines. */
export function isAppErrorCode(code: string | null): code is AppErrorCode {
	return code !== null && KNOWN_CODES.has(code);
}
