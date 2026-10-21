import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';

import { InvalidShipment, InvalidTransition, NotOwner, TrackingNumberRequired } from './errors';
import { Shipment_TITLE_MAX_LENGTH, Shipment_TRACKING_NUMBER_MAX_LENGTH } from './shipment-draft';
import {
	receiveShipment,
	registerShipment,
	reviseShipment,
	shipShipment,
	type Shipment,
} from './shipments';

const ownerId = 'owner-1';
const otherId = 'owner-2';

const shipment = (overrides: Partial<Shipment> = {}): Shipment => ({
	title: 'Sample',
	recipientName: 'Lab',
	trackingNumber: 'TN-1',
	status: 'draft',
	ownerId,
	...overrides,
});

describe('registerShipment', () => {
	it.effect('trims text, stores a blank tracking number as null, and starts as draft', () =>
		Effect.gen(function* () {
			const registered = yield* registerShipment({
				title: '  Sample  ',
				recipientName: '  Lab  ',
				trackingNumber: '   ',
			});
			expect(registered).toEqual({
				title: 'Sample',
				recipientName: 'Lab',
				trackingNumber: null,
				status: 'draft',
			});
		}),
	);

	it.effect('keeps a tracking number', () =>
		Effect.gen(function* () {
			const registered = yield* registerShipment({
				title: 'Sample',
				recipientName: 'Lab',
				trackingNumber: '  TN-1  ',
			});
			expect(registered.trackingNumber).toBe('TN-1');
		}),
	);

	it.effect('fails with InvalidShipment for a blank title', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				registerShipment({ title: '   ', recipientName: 'Lab', trackingNumber: '' }),
			);
			expect(error).toBeInstanceOf(InvalidShipment);
		}),
	);

	it.effect('fails with InvalidShipment for a blank recipient', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				registerShipment({ title: 'Sample', recipientName: '   ', trackingNumber: '' }),
			);
			expect(error).toBeInstanceOf(InvalidShipment);
		}),
	);

	it.effect('fails with InvalidShipment for a title or tracking number that is too long', () =>
		Effect.gen(function* () {
			const longTitle = yield* Effect.flip(
				registerShipment({
					title: 'x'.repeat(Shipment_TITLE_MAX_LENGTH + 1),
					recipientName: 'Lab',
					trackingNumber: '',
				}),
			);
			const longTracking = yield* Effect.flip(
				registerShipment({
					title: 'Sample',
					recipientName: 'Lab',
					trackingNumber: 'x'.repeat(Shipment_TRACKING_NUMBER_MAX_LENGTH + 1),
				}),
			);
			expect(longTitle).toBeInstanceOf(InvalidShipment);
			expect(longTracking).toBeInstanceOf(InvalidShipment);
		}),
	);
});

describe('reviseShipment', () => {
	it.effect('lets the owner revise a draft and clear the tracking number', () =>
		Effect.gen(function* () {
			const revised = yield* reviseShipment(
				shipment(),
				{ title: '  Renamed  ', recipientName: 'Studio', trackingNumber: '  ' },
				ownerId,
			);
			expect(revised).toEqual({
				title: 'Renamed',
				recipientName: 'Studio',
				trackingNumber: null,
				status: 'draft',
				ownerId,
			});
		}),
	);

	it.effect('lets the owner change the tracking number of a shipped shipment', () =>
		Effect.gen(function* () {
			const revised = yield* reviseShipment(
				shipment({ status: 'shipped' }),
				{ title: 'Sample', recipientName: 'Lab', trackingNumber: 'TN-2' },
				ownerId,
			);
			expect(revised).toMatchObject({ trackingNumber: 'TN-2', status: 'shipped', ownerId });
		}),
	);

	it.effect('fails with NotOwner for someone else', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				reviseShipment(
					shipment(),
					{ title: 'Sample', recipientName: 'Lab', trackingNumber: 'TN-1' },
					otherId,
				),
			);
			expect(error).toBeInstanceOf(NotOwner);
			expect(error).toMatchObject({ actorId: otherId, ownerId });
		}),
	);

	it.effect('fails with InvalidShipment for a blank title', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				reviseShipment(
					shipment(),
					{ title: '   ', recipientName: 'Lab', trackingNumber: 'TN-1' },
					ownerId,
				),
			);
			expect(error).toBeInstanceOf(InvalidShipment);
		}),
	);

	it.effect('fails with InvalidTransition once the shipment is received', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				reviseShipment(
					shipment({ status: 'received' }),
					{ title: 'Sample', recipientName: 'Lab', trackingNumber: 'TN-1' },
					ownerId,
				),
			);
			expect(error).toBeInstanceOf(InvalidTransition);
		}),
	);

	it.effect('fails with TrackingNumberRequired when a shipped tracking number is cleared', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				reviseShipment(
					shipment({ status: 'shipped' }),
					{ title: 'Sample', recipientName: 'Lab', trackingNumber: '   ' },
					ownerId,
				),
			);
			expect(error).toBeInstanceOf(TrackingNumberRequired);
		}),
	);
});

describe('shipShipment', () => {
	it.effect('ships a draft that already has a tracking number', () =>
		Effect.gen(function* () {
			const shipped = yield* shipShipment(shipment(), ownerId);
			expect(shipped).toMatchObject({ status: 'shipped', trackingNumber: 'TN-1', ownerId });
		}),
	);

	it.effect('fails with TrackingNumberRequired when the draft has no tracking number', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(shipShipment(shipment({ trackingNumber: null }), ownerId));
			expect(error).toBeInstanceOf(TrackingNumberRequired);
		}),
	);

	it.effect('fails with NotOwner for someone else', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(shipShipment(shipment(), otherId));
			expect(error).toBeInstanceOf(NotOwner);
			expect(error).toMatchObject({ actorId: otherId, ownerId });
		}),
	);

	it.effect('fails with InvalidTransition unless the shipment is a draft', () =>
		Effect.gen(function* () {
			const shipped = yield* Effect.flip(shipShipment(shipment({ status: 'shipped' }), ownerId));
			const received = yield* Effect.flip(shipShipment(shipment({ status: 'received' }), ownerId));
			expect(shipped).toBeInstanceOf(InvalidTransition);
			expect(received).toBeInstanceOf(InvalidTransition);
		}),
	);
});

describe('receiveShipment', () => {
	it.effect('lets the owner and someone else receive a shipped shipment', () =>
		Effect.gen(function* () {
			const byOwner = yield* receiveShipment(shipment({ status: 'shipped' }), ownerId);
			const byOther = yield* receiveShipment(shipment({ status: 'shipped' }), otherId);
			expect(byOwner).toMatchObject({ status: 'received', ownerId });
			expect(byOther).toMatchObject({ status: 'received', ownerId });
		}),
	);

	it.effect(
		'fails with InvalidTransition when the owner receives a draft or a received shipment',
		() =>
			Effect.gen(function* () {
				const draft = yield* Effect.flip(receiveShipment(shipment({ status: 'draft' }), ownerId));
				const received = yield* Effect.flip(
					receiveShipment(shipment({ status: 'received' }), ownerId),
				);
				expect(draft).toBeInstanceOf(InvalidTransition);
				expect(received).toBeInstanceOf(InvalidTransition);
			}),
	);

	it.effect('fails with NotOwner when someone else receives a shipment that is not shipped', () =>
		Effect.gen(function* () {
			const draft = yield* Effect.flip(receiveShipment(shipment({ status: 'draft' }), otherId));
			const received = yield* Effect.flip(
				receiveShipment(shipment({ status: 'received' }), otherId),
			);
			expect(draft).toBeInstanceOf(NotOwner);
			expect(received).toBeInstanceOf(NotOwner);
			expect(draft).toMatchObject({ actorId: otherId, ownerId });
		}),
	);
});
