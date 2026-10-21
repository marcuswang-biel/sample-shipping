/**
 * Mutation builders with database triggers attached.
 *
 * Derived state (counters, search projections, denormalized mirrors) belongs in
 * triggers on `ctx.db`, not in calls sprinkled through the write sites. Define every
 * mutation with the builders exported here so a new write path cannot silently skip
 * a trigger. Importing `mutation` / `internalMutation` straight from
 * `_generated/server` is a lint error outside this file (see `.oxlintrc.json`).
 *
 * The template registers no triggers yet. Add them in `createTriggers()`:
 *
 *   triggers.register('claims', async (ctx, change) => { ... });
 */

import type { GenericMutationCtx } from 'convex/server';

import { customMutation } from 'convex-helpers/server/customFunctions';
import { Triggers } from 'convex-helpers/server/triggers';

import type { DataModel } from './_generated/dataModel';

import {
	internalMutation as rawInternalMutation,
	mutation as rawMutation,
} from './_generated/server';

type TriggerCtx = GenericMutationCtx<DataModel>;

function createTriggers() {
	const triggers = new Triggers<DataModel>();
	return triggers;
}

/** Wraps `ctx.db` so every registered trigger runs inside the same transaction. */
export function prepareMutation(ctx: TriggerCtx) {
	const triggers = createTriggers();
	return { ctx: triggers.wrapDB(ctx), args: {} };
}

export const mutation = customMutation(rawMutation, { args: {}, input: prepareMutation });
export const internalMutation = customMutation(rawInternalMutation, {
	args: {},
	input: prepareMutation,
});
