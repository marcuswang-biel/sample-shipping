import type { AuthConfig } from 'convex/server';

import { getAuthConfigProvider } from '@convex-dev/better-auth/auth-config';

// Better Auth (via the Convex component) issues the JWT Convex validates.
export default {
	providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
