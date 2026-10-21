import { lingui } from '@lingui/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Pinned only when worktree:setup (or a human) set a valid VITE_DEV_PORT.
	// Unpinned checkouts default to 3001 but leave strictPort off so a busy 3001
	// does not hard-fail ad-hoc setups. Empty/non-numeric values must not become
	// Number("") === 0 or NaN under a hard port bind.
	const rawPort = loadEnv(mode, __dirname, 'VITE_').VITE_DEV_PORT;
	const parsedPort = Number.parseInt(rawPort ?? '', 10);
	const hasPinnedPort = Number.isInteger(parsedPort) && parsedPort > 0;
	const port = hasPinnedPort ? parsedPort : 3001;

	return {
		plugins: [
			tailwindcss(),
			tanstackRouter({ autoCodeSplitting: true }),
			react({
				babel: {
					plugins: ['@lingui/babel-plugin-lingui-macro', ['babel-plugin-react-compiler', {}]],
				},
			}),
			lingui(),
		],
		resolve: {
			// Shared workspace UI packages must use the application's React instance.
			dedupe: ['react', 'react-dom'],
			alias: {
				'@': path.resolve(__dirname, './src'),
			},
		},
		server: {
			// Each worktree owns a fixed port: worktree:setup assigns VITE_DEV_PORT
			// (3001-3010) into apps/web/.env.local. When pinned, the port doubles as
			// this worktree's canonical auth origin (first SITE_URL entry), so
			// strictPort keeps a taken port a hard error instead of silently drifting
			// to an untrusted origin.
			port,
			strictPort: hasPinnedPort,
		},
	};
});
