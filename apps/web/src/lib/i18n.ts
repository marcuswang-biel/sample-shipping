import { i18n, type Messages } from '@lingui/core';

export const APP_LOCALES = ['zh-Hant', 'en'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const SOURCE_LOCALE: AppLocale = 'zh-Hant';
export const LOCALE_STORAGE_KEY = 'acme-locale';

export const LOCALE_LABELS: Record<AppLocale, string> = {
	'zh-Hant': '繁體中文',
	en: 'English',
};

const catalogLoaders: Record<AppLocale, () => Promise<{ messages: Messages }>> = {
	'zh-Hant': () => import('@/locales/zh-Hant/messages.po'),
	en: () => import('@/locales/en/messages.po'),
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
	return APP_LOCALES.some((locale) => locale === value);
}

/** Maps a BCP 47 tag from the browser to a supported locale, or `null`. */
export function matchLocale(tag: string): AppLocale | null {
	const normalized = tag.toLowerCase();
	if (normalized.startsWith('zh')) return 'zh-Hant';
	if (normalized.startsWith('en')) return 'en';
	return null;
}

export function detectLocale(): AppLocale {
	if (typeof window === 'undefined') {
		return SOURCE_LOCALE;
	}

	try {
		const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
		if (isAppLocale(stored)) {
			return stored;
		}
	} catch {
		// Ignore blocked storage and fall back to the browser language.
	}

	for (const tag of [navigator.language, ...(navigator.languages ?? [])]) {
		const locale = matchLocale(tag);
		if (locale) return locale;
	}

	return SOURCE_LOCALE;
}

export async function activateLocale(locale: AppLocale) {
	const { messages } = await catalogLoaders[locale]();
	i18n.loadAndActivate({ locale, messages });

	if (typeof document !== 'undefined') {
		document.documentElement.lang = locale;
	}

	try {
		window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	} catch {
		// Locale still applies for this session if storage is unavailable.
	}
}

export async function setupI18n() {
	await activateLocale(detectLocale());
	return i18n;
}
