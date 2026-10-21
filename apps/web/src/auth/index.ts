/**
 * The web app's whole auth surface. Everything outside `src/auth/` imports from
 * here and from `convex/react` (`useConvexAuth`), so swapping the auth provider
 * only touches this folder.
 */
export { AuthProvider } from './auth-provider';
export { SignInPanel } from './sign-in-panel';
export { useSignOut } from './use-sign-out';
export { convexClientOptions } from './convex-client-options';
