// Typed import.meta.env (official Vite pattern, env-and-mode docs).
// strictImportMetaEnv makes any undeclared key a type error, so typos die at
// compile time. Values are machine-written by scripts/setup-worktree.mjs
// (worktrees) or the deploy workflow (prod). Add new VITE_ vars here first.

interface ViteTypeOptions {
	strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
	/** Convex client URL (local deployment in worktrees, cloud in prod). */
	readonly VITE_CONVEX_URL: string;
	/** Convex HTTP-actions site URL. */
	readonly VITE_CONVEX_SITE_URL: string;
	/** This worktree's fixed dev port. Config-time only (read via loadEnv in vite.config.ts). */
	readonly VITE_DEV_PORT?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module '*.po' {
	import type { Messages } from '@lingui/core';

	export const messages: Messages;
}
