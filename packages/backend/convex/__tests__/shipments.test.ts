// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexErrorCode } from '@shipping/shared/convex-error';
import { APP_ERROR_CODES } from '@shipping/shared/error-codes';
import { describe, expect, it } from 'vitest';

import { convexTest, signIn } from '../../test/harness';
import { api } from '../_generated/api';
import schema from '../schema';

const modules = import.meta.glob(['../**/*.ts', '../**/*.js', '!../**/*.d.ts', '!../**/*.test.ts']);

async function codeOf(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		return convexErrorCode(error);
	}
	throw new Error('expected the call to fail');
}

const sample = {
	title: '  Sample  ',
	recipientName: '  Lab  ',
	trackingNumber: '  TN-1  ',
};

describe('shipments', () => {
	it('rejects anonymous callers', async () => {
		const t = convexTest(schema, modules);
		expect(await codeOf(t.query(api.shipments.listMine, {}))).toBe(APP_ERROR_CODES.unauthenticated);
		expect(await codeOf(t.query(api.shipments.listInTransit, {}))).toBe(
			APP_ERROR_CODES.unauthenticated,
		);
		expect(await codeOf(t.mutation(api.shipments.register, sample))).toBe(
			APP_ERROR_CODES.unauthenticated,
		);
	});

	it('registers a draft for its owner and stores a blank tracking number as null', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const bob = await signIn(t, 'bob@example.com');

		const registered = await alice.as.mutation(api.shipments.register, {
			title: '  Sample  ',
			recipientName: '  Lab  ',
		});

		expect(registered).toMatchObject({
			title: 'Sample',
			recipientName: 'Lab',
			trackingNumber: null,
			status: 'draft',
		});
		const mine = await alice.as.query(api.shipments.listMine, {});
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ ownerId: alice.userId, status: 'draft', trackingNumber: null });
		expect(await bob.as.query(api.shipments.listMine, {})).toEqual([]);
		expect(await alice.as.query(api.shipments.listInTransit, {})).toEqual([]);
	});

	it('maps InvalidShipment to SHIPMENT_INVALID and writes nothing', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');

		expect(await codeOf(alice.as.mutation(api.shipments.register, { ...sample, title: ' ' }))).toBe(
			APP_ERROR_CODES.shipmentInvalid,
		);
		expect(await alice.as.query(api.shipments.listMine, {})).toEqual([]);
	});

	it('hides another user from drafts and rejects the owner receiving one', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const bob = await signIn(t, 'bob@example.com');
		const { shipmentId } = await alice.as.mutation(api.shipments.register, sample);

		expect(await codeOf(t.mutation(api.shipments.ship, { shipmentId }))).toBe(
			APP_ERROR_CODES.unauthenticated,
		);
		expect(
			await codeOf(
				bob.as.mutation(api.shipments.revise, {
					shipmentId,
					title: 'Stolen',
					recipientName: 'Bob',
				}),
			),
		).toBe(APP_ERROR_CODES.notFound);
		expect(await codeOf(bob.as.mutation(api.shipments.ship, { shipmentId }))).toBe(
			APP_ERROR_CODES.notFound,
		);
		expect(await codeOf(bob.as.mutation(api.shipments.receive, { shipmentId }))).toBe(
			APP_ERROR_CODES.notFound,
		);
		expect(await codeOf(alice.as.mutation(api.shipments.receive, { shipmentId }))).toBe(
			APP_ERROR_CODES.shipmentInvalidTransition,
		);

		const mine = await alice.as.query(api.shipments.listMine, {});
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ title: 'Sample', status: 'draft', trackingNumber: 'TN-1' });
	});

	it('lets the owner clear a draft tracking number, then requires one before shipping', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const { shipmentId } = await alice.as.mutation(api.shipments.register, sample);

		const cleared = await alice.as.mutation(api.shipments.revise, {
			shipmentId,
			title: 'Sample',
			recipientName: 'Lab',
			trackingNumber: '   ',
		});
		expect(cleared.trackingNumber).toBeNull();
		expect(await codeOf(alice.as.mutation(api.shipments.ship, { shipmentId }))).toBe(
			APP_ERROR_CODES.shipmentTrackingRequired,
		);

		await alice.as.mutation(api.shipments.revise, {
			shipmentId,
			title: 'Sample',
			recipientName: 'Studio',
			trackingNumber: 'TN-2',
		});
		const shipped = await alice.as.mutation(api.shipments.ship, { shipmentId });
		expect(shipped).toMatchObject({
			status: 'shipped',
			trackingNumber: 'TN-2',
			recipientName: 'Studio',
		});
	});

	it('lists a shipped sample for every signed-in user and lets any of them receive it', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const bob = await signIn(t, 'bob@example.com');
		const { shipmentId } = await alice.as.mutation(api.shipments.register, sample);
		await alice.as.mutation(api.shipments.ship, { shipmentId });

		expect(await alice.as.query(api.shipments.listInTransit, {})).toHaveLength(1);
		expect(await bob.as.query(api.shipments.listInTransit, {})).toMatchObject([
			{ title: 'Sample', status: 'shipped', ownerId: alice.userId },
		]);
		expect(await bob.as.query(api.shipments.listMine, {})).toEqual([]);

		const received = await bob.as.mutation(api.shipments.receive, { shipmentId });
		expect(received.status).toBe('received');
		expect(await alice.as.query(api.shipments.listInTransit, {})).toEqual([]);
		expect(await alice.as.query(api.shipments.listMine, {})).toMatchObject([
			{ status: 'received', ownerId: alice.userId },
		]);
	});

	it('refuses edits after shipping or receiving, and a second receive', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const { shipmentId } = await alice.as.mutation(api.shipments.register, sample);
		await alice.as.mutation(api.shipments.ship, { shipmentId });

		expect(
			await codeOf(
				alice.as.mutation(api.shipments.revise, {
					shipmentId,
					title: 'Sample',
					recipientName: 'Lab',
					trackingNumber: '',
				}),
			),
		).toBe(APP_ERROR_CODES.shipmentTrackingRequired);
		expect(await codeOf(alice.as.mutation(api.shipments.ship, { shipmentId }))).toBe(
			APP_ERROR_CODES.shipmentInvalidTransition,
		);

		await alice.as.mutation(api.shipments.receive, { shipmentId });
		expect(
			await codeOf(
				alice.as.mutation(api.shipments.revise, {
					shipmentId,
					title: 'Changed',
					recipientName: 'Lab',
					trackingNumber: 'TN-1',
				}),
			),
		).toBe(APP_ERROR_CODES.shipmentInvalidTransition);
		expect(await codeOf(alice.as.mutation(api.shipments.receive, { shipmentId }))).toBe(
			APP_ERROR_CODES.shipmentInvalidTransition,
		);
	});
});
