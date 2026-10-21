import { authClient } from './auth-client';

/** Returns a function that ends the Better Auth session and clears SecureStore. */
export function useSignOut() {
	return async () => {
		await authClient.signOut();
	};
}
