/**
 * The native app's whole auth surface. Everything outside `auth/` imports from
 * here and from `convex/react` (`useConvexAuth`), so swapping the auth provider
 * only touches this folder.
 */
export { AuthProvider } from './auth-provider';
export { SignInScreen } from './sign-in-screen';
export { useSignOut } from './use-sign-out';
export { convexClientOptions } from './convex-client-options';
