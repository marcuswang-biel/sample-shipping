// Runtime-validated, typed client env (t3-env + zod): the app fails fast at
// boot with a readable error when a variable is missing or malformed, instead
// of surfacing as undefined behavior deep in the Convex/auth clients.
// Adding a VITE_ var: declare its schema here and its raw type in
// src/vite-env.d.ts (strict import.meta.env), then consume it via `env.*`.
import { createEnv } from '@t3-oss/env-core';
import * as z from 'zod';

function formatEnvIssues(
	issues: ReadonlyArray<{
		message: string;
		path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
	}>,
): string {
	return issues
		.map((issue) => {
			const path =
				issue.path
					?.map((segment) =>
						typeof segment === 'object' && segment !== null && 'key' in segment
							? segment.key
							: segment,
					)
					.join('.') || '(root)';
			return `  - ${path}: ${issue.message}`;
		})
		.join('\n');
}

const requiredViteUrl = (name: string) =>
	z
		.string({ error: `${name} is required (apps/web/.env.local or deploy env)` })
		.pipe(z.url({ error: `${name} must be a valid URL` }));

export const env = createEnv({
	clientPrefix: 'VITE_',
	client: {
		// Injected at build time: prod by the deploy-web CI job (derived from
		// CONVEX_DEPLOY_KEY), dev from apps/web/.env.local (worktree:setup).
		VITE_CONVEX_URL: requiredViteUrl('VITE_CONVEX_URL'),
		// Convex HTTP-actions site URL (auth routes live there).
		VITE_CONVEX_SITE_URL: requiredViteUrl('VITE_CONVEX_SITE_URL'),
	},
	// Spread: strictImportMetaEnv removes the index signature from
	// ImportMetaEnv, so the object itself no longer satisfies Record<string, …>.
	runtimeEnv: { ...import.meta.env },
	emptyStringAsUndefined: true,
	onValidationError: (issues) => {
		const details = formatEnvIssues(issues);
		console.error(`Invalid environment variables:\n${details}`);
		throw new Error(
			`Invalid environment variables:\n${details}\n` +
				'Set them in apps/web/.env.local (pnpm worktree:setup) or the deploy workflow.',
		);
	},
});
