# AGENTS.md

`CLAUDE.md` links here. Edit this file only.

## Read before the relevant task

| Task                                         | Instructions                                          |
| -------------------------------------------- | ----------------------------------------------------- |
| Setup or worktree operation                  | `README.md`                                           |
| Auth (sign-in, sessions, provider config)    | `docs/auth.md`                                        |
| Domain terms                                 | `CONTEXT.md`                                          |
| Business logic                               | `docs/adr/0001-effect-boundary-for-business-logic.md` |
| Commit or PR                                 | `CONTRIBUTING.md`                                     |
| Syncing this repo with the upstream template | `TEMPLATE_SOURCE.md`                                  |

## Safety

- Production deployment runs only through merging the Release Please PR. Default to read-only investigation.
- Manual production writes (deploy, import, migration, mutation, environment change) need explicit confirmation naming the operation and target.
- The user runs dev. Verify with checks instead of restarting servers. Stop only PIDs you started.
- Each worktree owns its local Convex backend, `.env.local` files and stable port. Keep them isolated.
- Worktree setup permits only `anonymous:` or `local:` deployments with loopback URLs. Never target `dev:…`, `*.convex.cloud` or deploy keys, and never copy cloud env files into a worktree.

## Design

- Build the simplest complete solution for current requirements. Avoid speculative abstractions.
- Reuse installed dependencies. Check docs and types before adding a library.
- Remove obsolete paths. Schema changes that touch existing data use expand → backfill → contract through `convex/migrations.ts`.
- If a repository rule conflicts with the task, explain the conflict and get sign-off before breaking it.

## Repository map

pnpm workspaces with Turborepo.

| Path                                                            | Role                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web/`                                                     | Vite + React web app; file routes in `src/routes`, auth in `src/auth` |
| `apps/native/`                                                  | Expo Router app; auth in `auth/`                                      |
| `packages/backend/convex/`                                      | Convex schema and functions; helpers in `lib`                         |
| `packages/domain/`                                              | Business rules in Effect. Never imports Convex                        |
| `packages/shared/`                                              | Types and helpers shared by backend and clients (error codes)         |
| `packages/web-ui/`                                              | Radix + Tailwind primitives                                           |
| `packages/config/`                                              | `tsconfig.base.json`                                                  |
| `packages/eslint-plugin-app-lingui/`, `tools/oxlint/anti-slop/` | Local lint rules                                                      |

## Setup and verification

- New worktree: `pnpm install`, then `pnpm worktree:setup`. Web ports 3001–3010 use `VITE_DEV_PORT` with strictPort.
- Required before a PR: `pnpm check` and the tests of the packages you touched. CI runs `check`, `build` and `test`.
- `check` does not rewrite files. Format with `pnpm fmt`.
- Run lint from the monorepo root. Do not run `oxlint .` inside `apps/web`; its Tailwind rules use root-relative paths.
- Add dependencies with `pnpm add`; shared versions go through the catalog in `pnpm-workspace.yaml` (`name@catalog:`).
- After changing Convex functions, run `pnpm dev:backend` (or `pnpm -C packages/backend exec convex dev --once`) so `convex/_generated` is regenerated, and commit it. `check:codegen` fails when it is stale.

## Code conventions

- TypeScript, tabs, single quotes, oxfmt. Keep tests next to the code they cover.
- Business rules live in `packages/domain` as Effect programs with tagged errors. A Convex handler authorizes, reads, runs the program, maps tagged errors to `ConvexError({ code, message })` with a code from `packages/shared/src/error-codes.ts`, then writes. See ADR 0001 and `convex/claims.ts`.
- Every Convex function declares `args` and `returns` validators.
- Owner-scoped data stores `ownerId` = `requireUserId(ctx)` (the token subject) and checks it on every read and write.
- Import mutation builders from `convex/functions.ts`, never `_generated/server`. The wrapper runs database triggers.
- `ctx.db.get/patch/replace/delete` take the table name first.
- Lingui source locale is `zh-Hant`; locales are `zh-Hant` and `en`. JSX uses `<Trans>`. React strings use `useLingui` from `@lingui/react/macro`; other strings use `t` from `@lingui/core/macro`. Static maps use `msg`, resolved with `t(descriptor)`. After changing strings, run `pnpm -F @acme/web i18n:extract` and fill `en`.
- Persist enums as English codes and translate the label in the client.
- React Compiler is enabled. Add `memo`, `useMemo` or `useCallback` only with a one-line reason.

## Delivery

- Commits and PR titles use `<type>(<scope>): <subject>` with a lowercase subject. Scopes: `web`, `native`, `backend`, `domain`, `shared`, `deps`.
- Only `feat`, `fix` and `perf` trigger release PRs. Versions follow changed paths. Squash-merge.
