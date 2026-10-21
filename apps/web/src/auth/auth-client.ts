import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { env } from '@/lib/env';

// The Convex site URL serves Better Auth's routes. `crossDomainClient` stores the
// session cookie for that origin, since the web app runs on a different one.
export const authClient = createAuthClient({
	baseURL: env.VITE_CONVEX_SITE_URL,
	plugins: [convexClient(), crossDomainClient()],
});
