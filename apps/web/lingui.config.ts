import { defineConfig } from '@lingui/cli';

export default defineConfig({
	sourceLocale: 'zh-Hant',
	locales: ['zh-Hant', 'en'],
	catalogs: [
		{
			path: '<rootDir>/src/locales/{locale}/messages',
			include: ['src'],
		},
	],
});
