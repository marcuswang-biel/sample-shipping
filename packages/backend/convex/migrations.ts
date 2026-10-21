/**
 * Migrations
 *
 * The active post-deploy queue. Completed migrations are removed from `runAll` once
 * they are confirmed done on prod; their source stays in git history.
 *
 * Usage:
 * - Run all: pnpm exec convex run migrations:runAll
 * - Run single: pnpm exec convex run migrations:run '{"fn": "migrations:<name>"}'
 * - On release, `runAll` is invoked automatically by the deploy-convex CI job.
 *
 * Add a migration:
 *
 *   export const backfillClaimCurrency_20270101 = migrations.define({
 *     table: 'claims',
 *     migrateOne: async (_ctx, claim) => (claim.currency ? undefined : { currency: 'HKD' }),
 *   });
 *
 * then append `internal.migrations.backfillClaimCurrency_20270101` to `releaseQueue`.
 * Migrations must be idempotent: `runAll` re-runs on every release, and the
 * component skips a migration that already completed.
 */

import { type MigrationFunctionReference, Migrations } from '@convex-dev/migrations';
import { v } from 'convex/values';

import type { DataModel } from './_generated/dataModel';

import { components } from './_generated/api';
import { internalMutation } from './functions';
import schema from './schema';

// Backfills write through the trigger-wrapped builder, so re-touching a row is
// all it takes to (re)build state that hangs off that table.
export const migrations = new Migrations<DataModel, typeof schema>(components.migrations, {
	internalMutation,
	schema,
});

/** Post-deploy queue, oldest first. Remove an entry once prod reports it done. */
const releaseQueue: MigrationFunctionReference[] = [];

/**
 * Runs `releaseQueue` serially. Not `migrations.runner(releaseQueue)`: the runner
 * rejects an empty series, and the queue is empty most of the time.
 */
export const runAll = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		if (releaseQueue.length > 0) {
			await migrations.runSerially(ctx, releaseQueue);
		}
		return null;
	},
});

// General purpose runner
export const run = migrations.runner();
