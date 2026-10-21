/**
 * Expo inlines only `EXPO_PUBLIC_*` variables, and only when read as literal
 * `process.env.EXPO_PUBLIC_…` expressions, so each one is read by name here.
 */
function required(name: string, value: string | undefined): string {
	if (!value) {
		throw new Error(`${name} is required (apps/native/.env.local, written by pnpm worktree:setup)`);
	}
	return value;
}

export const env = {
	convexUrl: required('EXPO_PUBLIC_CONVEX_URL', process.env.EXPO_PUBLIC_CONVEX_URL),
	convexSiteUrl: required('EXPO_PUBLIC_CONVEX_SITE_URL', process.env.EXPO_PUBLIC_CONVEX_SITE_URL),
};
