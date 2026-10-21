import { authClient } from './auth-client';

/** Returns a function that ends the Better Auth session. */
export function useSignOut() {
	return async () => {
		await authClient.signOut();
	};
}
