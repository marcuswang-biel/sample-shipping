# ADR 0001: Business logic is written in Effect; Convex handlers are the boundary

- Status: accepted

## Context

Convex handlers mix four jobs: authorization, reads, the business decision and writes. When the decision lives inline, it can only be tested through convex-test, its failure modes are untyped `throw`s, and it cannot be reused by an action, a script or another client.

## Decision

1. Business rules live in `packages/domain`, written as Effect programs. The package depends on `effect` only. It never imports `convex` or `@acme/backend`; `packages/domain/.oxlintrc.json` makes that a lint error.
2. A rule's expected failures are tagged errors (`Schema.TaggedErrorClass`). Its configuration and collaborators are services provided through a `Layer`. Its input is decoded with Effect Schema, so validation is part of the rule.
3. A Convex handler is the boundary. In order, it:
   1. authorizes (`requireUserId(ctx)`),
   2. reads what the rule needs from `ctx.db`,
   3. runs the program with `Effect.runPromiseExit(program.pipe(Effect.provide(Live)))`,
   4. maps each tagged error to `ConvexError({ code, message })`, with `code` from `packages/shared/src/error-codes.ts`, and rethrows defects unchanged,
   5. writes the result.
4. Rules are tested with `@effect/vitest` against a test `Layer`. The handler is tested with convex-test for authorization, reads, writes and the error-code mapping.

The reference implementation is `packages/domain/src/claims/` (rule) and `packages/backend/convex/claims.ts` (`submit`).

## Consequences

- Clients branch on stable error codes, never on messages. Production Convex redacts messages; `convexErrorCode()` in `packages/shared` reads the code from `error.data`.
- The rule does no I/O, so the handler keeps Convex's transaction guarantees: everything the rule saw was read in the same mutation that writes the decision.
- Keep rules free of timers and scheduling. Convex queries and mutations are deterministic, and `runPromiseExit` resolves within the same handler only while the program stays synchronous. If a rule needs I/O, give it a service whose implementation the handler builds from `ctx`, or move the work to an action.
- Simple CRUD that has no decision in it stays a plain Convex function. The boundary applies when there is a rule worth naming.
- Effect is pinned to `4.0.0-beta.43` with the matching `@effect/vitest`. Moving to Effect 4.0 stable requires vitest 5 across the workspace; do both together.
