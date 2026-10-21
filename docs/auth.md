# Auth: Better Auth on Convex

Better Auth runs inside the Convex deployment through the `@convex-dev/better-auth` component. Both clients end up with a Convex JWT whose `sub` is the Better Auth user id. Domain code reads only that subject (`packages/backend/convex/lib/identity.ts`), so tables like `claims` do not depend on the auth library.

## How it is wired

- **Backend.** `convex/convex.config.ts` installs the component. `convex/auth.ts` builds the Better Auth instance with email + password and three plugins: `convex` (issues the Convex JWT), `crossDomain` (web runs on a different origin than the Convex site URL) and `expo` (native). `convex/http.ts` mounts the routes under `/api/auth/*` with CORS.
- **Web.** `apps/web/src/auth/` holds the client (`convexClient` + `crossDomainClient`), `ConvexBetterAuthProvider`, the sign-in form and `useSignOut`. The rest of the app uses only `useConvexAuth()` and `@/auth`.
- **Native.** `apps/native/auth/` uses Better Auth's official Expo client (`@better-auth/expo/client`) with the session stored in `expo-secure-store`, plus `convexClient`. The backend trusts the app scheme (`acme://`, from `app.json`).

## Deployment env

| Variable             | Where it comes from                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`           | Comma-separated trusted web origins; the first is canonical. `worktree:setup` sets all local ports. Prod: the web URL. |
| `BETTER_AUTH_SECRET` | 32 random bytes, hex. `worktree:setup` generates it; set your own in prod.                                             |
| `NATIVE_APP_SCHEME`  | Optional. Defaults to `acme`; must match `scheme` in `apps/native/app.json`.                                           |
| `CONVEX_DEBUG`       | `true` on local dev only. Unlocks the dev seed and trusts `exp://` for Expo Go. Never set in prod.                     |

Client env: `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` (web) and `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` (native). `worktree:setup` writes them.

## Dev login

`pnpm worktree:setup` (and every `pnpm dev`, through `convex dev --run init`) creates:

- Email: `dev@example.com`
- Password: `devpassword`

New accounts can also sign up from the web sign-in page.

## Tests

`packages/backend/test/harness.ts` registers the component with convex-test and `signIn(t, email)` creates a real Better Auth user and session, so tests exercise production authorization.

## Auth-specific files

These are the only files that differ between `monorepo-template-better-auth` and `monorepo-template-logto` (verified with `diff -rq`):

- Backend: `packages/backend/convex/{auth.ts,auth.config.ts,convex.config.ts,http.ts,init.ts}`, `packages/backend/convex/_generated/api.d.ts`, `packages/backend/test/harness.ts`, `packages/backend/{package.json,.env.example}`
- Web: `apps/web/src/auth/*`, `apps/web/src/locales/{en,zh-Hant}/messages.po`, `apps/web/{package.json,.env.example}`
- Native: `apps/native/auth/*`, `apps/native/package.json`
- Workspace: `scripts/setup-auth.mjs`, `pnpm-workspace.yaml` (catalog), `pnpm-lock.yaml`
- Docs: `docs/auth.md`, `TEMPLATE_SOURCE.md`

Everything else, including `scripts/setup-worktree.mjs`, `apps/native/app.json` and every route, is identical. Code outside `src/auth/` and `auth/` reaches auth only through `useConvexAuth()` and the `@/auth` exports (`AuthProvider`, `SignInPanel`/`SignInScreen`, `useSignOut`, `convexClientOptions`).
