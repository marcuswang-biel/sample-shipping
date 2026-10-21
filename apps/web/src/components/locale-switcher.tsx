import { useLingui } from '@lingui/react/macro';

import { activateLocale, APP_LOCALES, isAppLocale, LOCALE_LABELS, SOURCE_LOCALE } from '@/lib/i18n';

export function LocaleSwitcher() {
	const { i18n, t } = useLingui();
	const locale = isAppLocale(i18n.locale) ? i18n.locale : SOURCE_LOCALE;

	return (
		<select
			aria-label={t`語言`}
			className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
			value={locale}
			onChange={(event) => {
				const next = event.target.value;
				if (isAppLocale(next)) void activateLocale(next);
			}}
		>
			{APP_LOCALES.map((value) => (
				<option key={value} value={value}>
					{LOCALE_LABELS[value]}
				</option>
			))}
		</select>
	);
}
