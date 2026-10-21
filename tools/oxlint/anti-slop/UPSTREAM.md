# Upstream provenance and update procedure

This directory vendors selected generic rules from [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop). Its MIT [LICENSE](./LICENSE) is retained unchanged.

- Base snapshot: [`cd064fe602b5915ff35e1e1c20836ca9bcb3729a`](https://github.com/dmmulroy/anti-slop/commit/cd064fe602b5915ff35e1e1c20836ca9bcb3729a), vendored 2026-08-14.
- Upstream reviewed 2026-09-07: [`e8c4880471b23ab7f216fba7b27d173a6ef07d4c`](https://github.com/dmmulroy/anti-slop/commit/e8c4880471b23ab7f216fba7b27d173a6ef07d4c).
- Source root: `src/`. This is a selective backport, not a package upgrade.

## Selective backports

From [`298c993`](https://github.com/dmmulroy/anti-slop/commit/298c993), as present in the reviewed snapshot:

- `shared/type-alias-resolution.ts` and `shared/lexical-type-parameters.ts` replace the local alias-only resolver. They resolve scoped and generic aliases and recognize competing interface, enum, class, import and type-parameter bindings.
- The resolver integration in `no-object-parameters`, `no-unknown-returns` and `no-unknown-type-aliases` replaces per-file node queues with an environment initialized at `Program` entry. The existing local parameter helpers remain.
- Local corrections keep named class expressions scoped to the class, recognize import-equals bindings, keep nested conditional infer binders inside their conditional, and traverse visitor-selected AST fields without adding assertions.

From [`63d6966`](https://github.com/dmmulroy/anti-slop/commit/63d6966): mapped key unions use `some`, so a union containing `string`, `number` or `symbol` remains broad.

No Effect rules, packaging changes or unrelated rule-policy changes were imported.

## Remaining local differences

Local corrections include:

| Rule                                        | Local correction beyond the backports                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-conditional-empty-object-spread`        | Unwrap both conditional branches. The current Oxlint parser already strips these parentheses; the issue's runtime reproducer passes before this source correction.                                                                                                                                                                        |
| `no-known-value-widening`                   | Only broad-key `Record`s are open dictionaries, and named aliases and interfaces are owner contracts. Bindings that are reassigned or have properties written are mutable state. Anonymous object return annotations and exported functions' return annotations are declared contracts.                                                   |
| `no-module-mocking`                         | Resolve namespace imports and their `vi`/`vitest`/`jest` members through lexical value bindings, including static computed properties.                                                                                                                                                                                                    |
| `no-runtime-typeof`                         | Report only `typeof` on untrusted input outside a parser seam: a `catch` parameter, an unannotated `JSON.parse` result or an `any` binding, directly or through a member. Globals, typed bindings and functions that accept `unknown` or return a type predicate are exempt.                                                              |
| `no-shape-in-symbol-names`                  | Report only names the linted module declares: bindings, parameters, type declarations, members and renamed imports. Member reads such as Zod's `.shape`, object keys and non-renamed imports belong to another contract.                                                                                                                  |
| `no-unknown-parameters`                     | Replace the `cause` name exemption with parser seams: a type predicate or assertion signature names the parameter, or the first read narrows, compares, tests or passes it to a call, directly or as an object-literal property value. A body that never reads the parameter passes nothing on. Signatures without a body stay contracts. |
| `no-unknown-returns`                        | Unwrap built-in Promise types only when no visible type binder shadows the name; resolve local aliases first.                                                                                                                                                                                                                             |
| `no-unsafe-dictionary-type`                 | Skip `satisfies` targets, generic constraints and type predicates over an `unknown` parameter; none of them hands callers a dictionary contract.                                                                                                                                                                                          |
| `no-widen-then-assert`                      | An explicit narrow declaration takes precedence over a broad initializer assertion. The original reproducer is invalid TypeScript, but lint must still respect the declared contract.                                                                                                                                                     |
| `require-safety-comment-for-type-assertion` | Report only assertions over input TypeScript cannot vouch for (`unknown`, `any`, thrown values, `JSON.parse` results) and assertions to Convex's generated `Id`. A literal asserted to `Id` is a fixture. `as const` stays exempt.                                                                                                        |
| `shared/dictionary-types`                   | Classify inline mapped types using the same broad-key test as aliases. Finite keys stay closed. `Record` with `keyof`, literal or literal-union keys is an object type, not a dictionary.                                                                                                                                                 |

`no-module-mocking` also takes a local `ownedModulePrefixes` option. With it, the rule reports only mocks of specifiers that start with a listed prefix; a specifier that is not a static string stays reported. Without it, the rule reports every module mock, as upstream does.

`no-widen-then-assert` remains a per-file `create` rule because it reads the file's scope manager during construction. Its cached scope references and dictionary classifications remain local. Other eligible rules use `createOnce` and `eslintCompatPlugin`.

Cross-file isolation is covered by a real Oxlint invocation over dirty and clean files. The backported resolver now replaces its environment at every `Program` entry. Preserve this isolation when updating.

## Repository policy

Twelve root-Oxlint errors are enabled: `no-known-value-widening`, `no-module-mocking`, `no-object-parameters`, `no-reflect-apply`, `no-reflect-get`, `no-runtime-typeof`, `no-shape-in-symbol-names`, `no-unknown-parameters`, `no-unknown-type-aliases`, `no-unsafe-dictionary-type`, `no-widen-then-assert`, `require-safety-comment-for-type-assertion`.

`no-module-mocking` runs with `ownedModulePrefixes` set to `./`, `../`, `@/` and `@acme/`. Mocks of third-party packages such as `convex/react` stay allowed, because those packages have no test client to substitute.

`no-unknown-returns` stays off. Some functions legitimately return untrusted data that the caller parses next, so enabling it needs a boundary policy first.

## Updating

1. Clone the exact upstream candidate outside this directory and record its SHA.
2. Compare `src/` with this vendor tree. Select specific fixes and reconcile the differences above.
3. Keep the MIT license and update the backport list and local differences.
4. From the monorepo root, run `pnpm --filter @acme/oxlint-anti-slop test` and `pnpm run check`. Tests include real RuleTester cases, plugin-loading positive controls and cross-file isolation.
5. Before enabling a deferred rule, scan with an explicit `jsPlugins` entry and a positive control that proves the rule ran. A zero-diagnostic invocation without plugin loading is not evidence.
