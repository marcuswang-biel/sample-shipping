import type { MessageDescriptor } from '@lingui/core';

import { msg } from '@lingui/core/macro';
import { APP_ERROR_CODES, type AppErrorCode } from '@shipping/shared/error-codes';

/** Translated text per backend error code. Resolve with `t(descriptor)` at the call site. */
export const SHIPMENT_ERROR_MESSAGES: Partial<Record<AppErrorCode, MessageDescriptor>> = {
	[APP_ERROR_CODES.unauthenticated]: msg`請先登入。`,
	[APP_ERROR_CODES.notFound]: msg`找不到這筆寄送。`,
	[APP_ERROR_CODES.shipmentInvalid]: msg`請填寫標題和收件人。標題和收件人最多 120 字，單號最多 64 字。`,
	[APP_ERROR_CODES.shipmentTrackingRequired]: msg`填了單號才能寄出，已寄出的單號也不能清空。`,
	[APP_ERROR_CODES.shipmentInvalidTransition]: msg`這個狀態不能這樣改。`,
};
