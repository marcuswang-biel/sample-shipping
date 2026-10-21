# Acme

Monorepo starter for BIEL projects: a Convex backend, a Vite + React web app and an Expo app sharing one auth provider, with business rules in Effect.

## Stack

| Path                | What it is                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| `apps/web/`         | Vite, React 19, TanStack Router + Query, Tailwind v4, Lingui (zh-Hant, en) |
| `apps/native/`      | Expo SDK 56, Expo Router                                                   |
| `packages/backend/` | Convex functions, schema, auth, migrations (`@convex-dev/migrations`)      |
| `packages/domain/`  | Business rules as Effect programs (no Convex imports)                      |
| `packages/shared/`  | Error codes and helpers used by backend and clients                        |
| `packages/web-ui/`  | Radix + Tailwind primitives (Button, Card, Input, Label)                   |
| `packages/config/`  | Shared `tsconfig.base.json`                                                |

Tooling: pnpm workspaces + catalog, Turborepo, oxlint (type-aware, with local `anti-slop` and Lingui rules) and oxfmt, vitest, convex-test, `@effect/vitest`, Release Please.

## Quick start

Requires Node 24 (`.nvmrc`) and pnpm 10 (`packageManager` in `package.json`; Corepack picks it up).

```bash
pnpm install
pnpm worktree:setup   # once per checkout/worktree: local Convex backend, auth env, dev user
pnpm dev              # web + backend
```

Open the URL `worktree:setup` prints (default http://localhost:3001). How to sign in (and the dev login, where there is one) is in `docs/auth.md`.

Native: `pnpm dev:native`, then open the app in a simulator or development build. `apps/native/.env.local` points at `127.0.0.1`; use your machine's LAN IP for a physical device.

`worktree:setup` only ever creates a local anonymous Convex backend. It refuses to run against a cloud deployment. Each git worktree gets its own backend and its own web port in 3001–3010.

## Scripts

| Command                                        | What it does                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Web + Convex dev servers                                                        |
| `pnpm dev:web` / `dev:backend` / `dev:native`  | One app                                                                         |
| `pnpm check`                                   | Lint, format check, typecheck, i18n catalog check, Convex codegen check         |
| `pnpm check-types` / `lint` / `test` / `build` | One task across the workspace                                                   |
| `pnpm fmt`                                     | Apply formatting                                                                |
| `pnpm worktree:setup`                          | Provision this worktree's local backend (idempotent)                            |
| `pnpm dev:setup`                               | Link the backend to a Convex cloud project (interactive; not used by worktrees) |

## Start a new project from this template

1. On GitHub, **Use this template** → create the repo, then clone it.
2. Rename the placeholder identity (`acme` / `Acme`) everywhere, on a clean tree:

   ```bash
   node scripts/rename.mjs billing "Billing Portal"
   pnpm install
   pnpm check
   ```

   This rewrites the npm scope (`@acme/*` → `@billing/*`), the Expo slug, scheme and bundle id (`com.acme.app` → `com.billing.app`), storage keys and display names. Review `git diff` before committing.

3. Replace the example domain: `packages/domain/src/claims`, `packages/backend/convex/claims.ts`, the `claims` table in `convex/schema.ts`, and the claims pages. Keep the pattern (ADR 0001).
4. Fill in `CONTEXT.md`.
5. Production setup (not done by the template): a Convex project and `CONVEX_DEPLOY_KEY`, Vercel project secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`), `EXPO_TOKEN` and an EAS project for native, and the auth provider config in `docs/auth.md`.

## More docs

- [AGENTS.md](AGENTS.md): rules for coding agents (and a good summary for humans)
- [docs/auth.md](docs/auth.md): how auth is wired, its env vars, and which files are auth-specific
- [docs/adr/0001-effect-boundary-for-business-logic.md](docs/adr/0001-effect-boundary-for-business-logic.md): where business logic goes
- [CONTRIBUTING.md](CONTRIBUTING.md): commits, scopes, releases
- [TEMPLATE_SOURCE.md](TEMPLATE_SOURCE.md): where the baseline came from, and how to keep both templates in sync
