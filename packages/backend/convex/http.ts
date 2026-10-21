import { httpRouter } from 'convex/server';

import { authComponent, createAuth } from './auth';

const http = httpRouter();

// Better Auth routes under /api/auth/*. CORS is required because the web app is
// served from a different origin than the Convex site URL.
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
