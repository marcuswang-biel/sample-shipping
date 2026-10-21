import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: ['@lingui/babel-plugin-lingui-macro'],
			},
		}),
		lingui(),
	],
	// Vite only DNS-resolves the *name* `localhost` when `server.host` is unset, so a runner
	// with no hosts entry for it kills the whole run with ENOTFOUND before a single test loads.
	server: {
		host: '127.0.0.1',
	},
	test: {
		setupFiles: ['./src/test-setup.ts'],
		include: ['src/**/__tests__/**/*.test.ts'],
	},
	resolve: {
		dedupe: ['react', 'react-dom'],
		alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
	},
});
