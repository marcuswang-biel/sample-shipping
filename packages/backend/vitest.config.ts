import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const backendRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
	// Vite only DNS-resolves the *name* `localhost` when `server.host` is unset, so a runner
	// with no hosts entry for it kills the whole run with ENOTFOUND before a single test loads.
	server: {
		host: '127.0.0.1',
	},
	test: {
		env: loadEnv(mode, backendRoot, ''),
		// The whole suite takes ~31s locally, so no test is anywhere near vitest's
		// 5s default — but a 2-core CI runner under load stretched the heaviest
		// files past it. Headroom for a slow runner, still short enough to fail a
		// genuinely hung test rather than sit until the job timeout.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		server: {
			deps: {
				inline: ['convex-test'],
			},
		},
	},
}));
