# Contributing

Commits and PR titles use `<type>(<scope>): <subject>`. Start the subject with a lowercase ASCII letter or a non-ASCII character.

| Type                                | Purpose                                            |
| ----------------------------------- | -------------------------------------------------- |
| `feat`                              | New feature                                        |
| `fix`                               | Bug fix                                            |
| `perf`                              | Performance improvement                            |
| `docs`, `style`, `refactor`, `test` | Documentation, formatting, restructuring, or tests |
| `chore`, `ci`, `build`, `revert`    | Maintenance, CI, build tooling, or reversal        |

Scopes are `web`, `native`, `backend`, `domain`, `shared` and `deps`. Mark breaking changes with `!` or a `BREAKING CHANGE:` footer.

Example: `fix(web): keep the claim form filled after a quota error`.

Run `pnpm check` and the relevant tests. Open a PR, pass CI, resolve review threads, then squash-merge.

Only `feat`, `fix` and `perf` trigger release PRs. Release Please versions `packages/backend`, `apps/web` and `apps/native` separately, by changed path. Merging the release PR deploys what it released (`.github/workflows/release-please.yml`).
