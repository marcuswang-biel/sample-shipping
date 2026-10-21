import { Effect, Schema } from 'effect';

import { InvalidShipment, InvalidTransition, NotOwner, TrackingNumberRequired } from './errors';
import { ShipmentDraft, type ShipmentRequest } from './shipment-draft';

export type ShipmentStatus = 'draft' | 'shipped' | 'received';

/** A shipment already stored. `ownerId` is the auth subject of the person who registered it. */
export type Shipment = {
	readonly title: string;
	readonly recipientName: string;
	readonly trackingNumber: string | null;
	readonly status: ShipmentStatus;
	readonly ownerId: string;
};

/** The result of registration. The caller attaches `ownerId` when it writes the row. */
export type RegisteredShipment = Omit<Shipment, 'ownerId' | 'status'> & {
	readonly status: 'draft';
};

const blankToNull = (trackingNumber: string): string | null => {
	const trimmed = trackingNumber.trim();
	return trimmed === '' ? null : trimmed;
};

const notOwner = (actorId: string, ownerId: string, reason: string) =>
	new NotOwner({ reason, actorId, ownerId });

/**
 * Decode a new shipment and leave it as a draft.
 * A blank tracking number is stored as `null`.
 */
export const registerShipment = (request: ShipmentRequest) =>
	Effect.gen(function* () {
		const draft = yield* Schema.decodeEffect(ShipmentDraft)(request).pipe(
			Effect.mapError((error) => new InvalidShipment({ reason: error.message })),
		);
		const registered: RegisteredShipment = {
			title: draft.title,
			recipientName: draft.recipientName,
			trackingNumber: blankToNull(draft.trackingNumber),
			status: 'draft',
		};
		return registered;
	});

/**
 * Replace the title, recipient, and tracking number.
 *
 * 1. Someone other than the owner fails with `NotOwner`.
 * 2. A malformed patch fails with `InvalidShipment`.
 * 3. A received shipment fails with `InvalidTransition`.
 * 4. Clearing the tracking number of a shipped shipment fails with `TrackingNumberRequired`.
 * 5. Otherwise the new content is returned with the same status and owner.
 */
export const reviseShipment = (current: Shipment, patch: ShipmentRequest, actorId: string) =>
	Effect.gen(function* () {
		if (actorId !== current.ownerId) {
			return yield* notOwner(actorId, current.ownerId, 'Only the owner can revise a shipment');
		}

		const draft = yield* Schema.decodeEffect(ShipmentDraft)(patch).pipe(
			Effect.mapError((error) => new InvalidShipment({ reason: error.message })),
		);

		if (current.status === 'received') {
			return yield* new InvalidTransition({
				reason: 'A received shipment cannot be revised',
			});
		}

		const trackingNumber = blankToNull(draft.trackingNumber);
		if (current.status === 'shipped' && trackingNumber === null) {
			return yield* new TrackingNumberRequired({
				reason: 'A shipped shipment must keep a tracking number',
			});
		}

		const revised: Shipment = {
			title: draft.title,
			recipientName: draft.recipientName,
			trackingNumber,
			status: current.status,
			ownerId: current.ownerId,
		};
		return revised;
	});

/**
 * Mark a draft as shipped.
 *
 * 1. Someone other than the owner fails with `NotOwner`.
 * 2. Anything other than a draft fails with `InvalidTransition`.
 * 3. A missing tracking number fails with `TrackingNumberRequired`.
 */
export const shipShipment = (current: Shipment, actorId: string) =>
	Effect.gen(function* () {
		if (actorId !== current.ownerId) {
			return yield* notOwner(actorId, current.ownerId, 'Only the owner can ship a shipment');
		}

		if (current.status !== 'draft') {
			return yield* new InvalidTransition({
				reason: 'Only a draft shipment can be shipped',
			});
		}

		if (current.trackingNumber === null) {
			return yield* new TrackingNumberRequired({
				reason: 'A tracking number is required before shipping',
			});
		}

		const shipped: Shipment = { ...current, status: 'shipped' };
		return shipped;
	});

/**
 * Mark a shipped sample as received. Any actor may receive a shipment that is in transit.
 * A shipment that is not shipped is `NotOwner` for someone else, and `InvalidTransition` for the owner.
 */
export const receiveShipment = (current: Shipment, actorId: string) =>
	Effect.gen(function* () {
		if (current.status === 'shipped') {
			const received: Shipment = { ...current, status: 'received' };
			return received;
		}

		if (actorId !== current.ownerId) {
			return yield* notOwner(
				actorId,
				current.ownerId,
				'Only the owner can receive a shipment that is not in transit',
			);
		}

		return yield* new InvalidTransition({
			reason: 'Only a shipped shipment can be received',
		});
	});
