import type { ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';

import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';

import { authClient } from './auth-client';

type AuthProviderProps = {
	client: ConvexReactClient;
	children: ReactNode;
};

/** Connects the Convex client to Better Auth. `useConvexAuth()` works anywhere below it. */
export function AuthProvider({ client, children }: AuthProviderProps) {
	return (
		<ConvexBetterAuthProvider client={client} authClient={authClient}>
			{children}
		</ConvexBetterAuthProvider>
	);
}
