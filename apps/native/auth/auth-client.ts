import { expoClient } from '@better-auth/expo/client';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/lib/env';

/** `scheme` from app.json. The backend trusts `<scheme>://` (NATIVE_APP_SCHEME). */
const scheme = String(Constants.expoConfig?.scheme ?? 'acme');

// Better Auth's official Expo client: the session cookie lives in SecureStore and
// rides on every request, so the Convex site URL needs no cross-domain cookie.
export const authClient = createAuthClient({
	baseURL: env.convexSiteUrl,
	plugins: [expoClient({ scheme, storagePrefix: scheme, storage: SecureStore }), convexClient()],
});
