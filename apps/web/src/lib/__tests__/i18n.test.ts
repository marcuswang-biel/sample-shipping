import { describe, expect, it } from 'vitest';

import { isAppLocale, matchLocale } from '../i18n';

describe('matchLocale', () => {
	it('maps every Chinese tag to Traditional Chinese', () => {
		expect(matchLocale('zh-HK')).toBe('zh-Hant');
		expect(matchLocale('zh-CN')).toBe('zh-Hant');
	});

	it('maps English tags to en', () => {
		expect(matchLocale('en-GB')).toBe('en');
	});

	it('returns null for an unsupported language', () => {
		expect(matchLocale('vi-VN')).toBeNull();
	});
});

describe('isAppLocale', () => {
	it('accepts only configured locales', () => {
		expect(isAppLocale('en')).toBe(true);
		expect(isAppLocale('zh-Hans')).toBe(false);
		expect(isAppLocale(null)).toBe(false);
	});
});
