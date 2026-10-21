import { ConvexReactClient } from 'convex/react';

import { convexClientOptions } from '@/auth';

import { env } from './env';

export const convex = new ConvexReactClient(env.convexUrl, {
	...convexClientOptions,
	// React Native has no beforeunload; the warning only applies to browsers.
	unsavedChangesWarning: false,
});
