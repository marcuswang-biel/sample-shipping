import { ConvexReactClient } from 'convex/react';

import { convexClientOptions } from '@/auth';
import { env } from '@/lib/env';

export const convex = new ConvexReactClient(env.VITE_CONVEX_URL, convexClientOptions);
