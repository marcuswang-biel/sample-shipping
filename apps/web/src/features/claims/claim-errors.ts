import type { MessageDescriptor } from '@lingui/core';

import { APP_ERROR_CODES, type AppErrorCode } from '@acme/shared/error-codes';
import { msg } from '@lingui/core/macro';

/** Translated text per backend error code. Resolve with `t(descriptor)` at the call site. */
export const CLAIM_ERROR_MESSAGES: Partial<Record<AppErrorCode, MessageDescriptor>> = {
	[APP_ERROR_CODES.unauthenticated]: msg`請先登入。`,
	[APP_ERROR_CODES.notFound]: msg`找不到這筆報銷。`,
	[APP_ERROR_CODES.claimInvalid]: msg`請填寫標題和大於零的金額。`,
	[APP_ERROR_CODES.claimMonthlyQuotaExceeded]: msg`這筆報銷會超出本月額度。`,
};
