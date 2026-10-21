/**
 * Sample shipments.
 *
 * Boundary between Convex and `packages/domain/src/shipments` (ADR 0001):
 *
 *   1. authorize (`requireUserId`),
 *   2. read the row,
 *   3. run the Effect program and map tagged errors to `ConvexError` codes,
 *   4. write the decision.
 *
 * `NotOwner` is returned as `NOT_FOUND`, so another user cannot tell a missing
 * row from one they are not allowed to change.
 */
import {
	receiveShipment,
	registerShipment,
	reviseShipment,
	shipShipment,
	type Shipment,
	type ShipmentError,
} from '@shipping/domain/shipments';
import { APP_ERROR_CODES, type AppErrorData } from '@shipping/shared/error-codes';
import { ConvexError, v } from 'convex/values';
import { Cause, Effect, Exit } from 'effect';

import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { query } from './_generated/server';
import { mutation } from './functions';
import { requireUserId } from './lib/identity';
import { shipmentStatusValidator } from './schema';

const shipmentValidator = v.object({
	_id: v.id('shipments'),
	_creationTime: v.number(),
	ownerId: v.string(),
	title: v.string(),
	recipientName: v.string(),
	trackingNumber: v.union(v.string(), v.null()),
	status: shipmentStatusValidator,
	createdAt: v.number(),
});

const shipmentResultValidator = v.object({
	shipmentId: v.id('shipments'),
	title: v.string(),
	recipientName: v.string(),
	trackingNumber: v.union(v.string(), v.null()),
	status: shipmentStatusValidator,
});

function notFound(): ConvexError<AppErrorData> {
	return new ConvexError({
		code: APP_ERROR_CODES.notFound,
		message: 'Shipment not found.',
	});
}

function toConvexError(error: ShipmentError): ConvexError<AppErrorData> {
	switch (error._tag) {
		case 'InvalidShipment':
			return new ConvexError({ code: APP_ERROR_CODES.shipmentInvalid, message: error.reason });
		case 'TrackingNumberRequired':
			return new ConvexError({
				code: APP_ERROR_CODES.shipmentTrackingRequired,
				message: error.reason,
			});
		case 'InvalidTransition':
			return new ConvexError({
				code: APP_ERROR_CODES.shipmentInvalidTransition,
				message: error.reason,
			});
		case 'NotOwner':
			return notFound();
	}
}

async function decide<A>(program: Effect.Effect<A, ShipmentError>): Promise<A> {
	const exit = await Effect.runPromiseExit(program);
	if (Exit.isFailure(exit)) {
		const failure = Cause.findErrorOption(exit.cause);
		if (failure._tag === 'Some') throw toConvexError(failure.value);
		throw Cause.squash(exit.cause);
	}
	return exit.value;
}

async function readShipment(ctx: QueryCtx, shipmentId: Id<'shipments'>): Promise<Doc<'shipments'>> {
	const shipment = await ctx.db.get('shipments', shipmentId);
	if (!shipment) throw notFound();
	return shipment;
}

function toDomain(shipment: Doc<'shipments'>): Shipment {
	return {
		title: shipment.title,
		recipientName: shipment.recipientName,
		trackingNumber: shipment.trackingNumber,
		status: shipment.status,
		ownerId: shipment.ownerId,
	};
}

function resultOf(shipmentId: Id<'shipments'>, shipment: Shipment) {
	return {
		shipmentId,
		title: shipment.title,
		recipientName: shipment.recipientName,
		trackingNumber: shipment.trackingNumber,
		status: shipment.status,
	};
}

/** The signed-in user's shipments, newest first. */
export const listMine = query({
	args: {},
	returns: v.array(shipmentValidator),
	handler: async (ctx) => {
		const ownerId = await requireUserId(ctx);
		return await ctx.db
			.query('shipments')
			.withIndex('by_owner_and_createdAt', (q) => q.eq('ownerId', ownerId))
			.order('desc')
			.take(100);
	},
});

/** Shipments that are in transit, newest first. Any signed-in user may read them. */
export const listInTransit = query({
	args: {},
	returns: v.array(shipmentValidator),
	handler: async (ctx) => {
		await requireUserId(ctx);
		return await ctx.db
			.query('shipments')
			.withIndex('by_status_and_createdAt', (q) => q.eq('status', 'shipped'))
			.order('desc')
			.take(100);
	},
});

/** Register a sample. It always starts as a draft. A blank tracking number is stored as null. */
export const register = mutation({
	args: {
		title: v.string(),
		recipientName: v.string(),
		trackingNumber: v.optional(v.string()),
	},
	returns: shipmentResultValidator,
	handler: async (ctx, args) => {
		const ownerId = await requireUserId(ctx);
		const decision = await decide(
			registerShipment({
				title: args.title,
				recipientName: args.recipientName,
				trackingNumber: args.trackingNumber ?? '',
			}),
		);
		const shipmentId = await ctx.db.insert('shipments', {
			ownerId,
			title: decision.title,
			recipientName: decision.recipientName,
			trackingNumber: decision.trackingNumber,
			status: decision.status,
			createdAt: Date.now(),
		});
		return resultOf(shipmentId, { ...decision, ownerId });
	},
});

/** Change the title, recipient, or tracking number. Only the registrant may do this. */
export const revise = mutation({
	args: {
		shipmentId: v.id('shipments'),
		title: v.string(),
		recipientName: v.string(),
		trackingNumber: v.optional(v.string()),
	},
	returns: shipmentResultValidator,
	handler: async (ctx, args) => {
		const actorId = await requireUserId(ctx);
		const current = await readShipment(ctx, args.shipmentId);
		const decision = await decide(
			reviseShipment(
				toDomain(current),
				{
					title: args.title,
					recipientName: args.recipientName,
					trackingNumber: args.trackingNumber ?? '',
				},
				actorId,
			),
		);
		await ctx.db.patch('shipments', args.shipmentId, {
			title: decision.title,
			recipientName: decision.recipientName,
			trackingNumber: decision.trackingNumber,
		});
		return resultOf(args.shipmentId, decision);
	},
});

/** Mark the registrant's draft as shipped. A tracking number must already be saved. */
export const ship = mutation({
	args: { shipmentId: v.id('shipments') },
	returns: shipmentResultValidator,
	handler: async (ctx, args) => {
		const actorId = await requireUserId(ctx);
		const current = await readShipment(ctx, args.shipmentId);
		const decision = await decide(shipShipment(toDomain(current), actorId));
		await ctx.db.patch('shipments', args.shipmentId, { status: decision.status });
		return resultOf(args.shipmentId, decision);
	},
});

/** Mark an in-transit shipment as received. Any signed-in user may do this. */
export const receive = mutation({
	args: { shipmentId: v.id('shipments') },
	returns: shipmentResultValidator,
	handler: async (ctx, args) => {
		const actorId = await requireUserId(ctx);
		const current = await readShipment(ctx, args.shipmentId);
		const decision = await decide(receiveShipment(toDomain(current), actorId));
		await ctx.db.patch('shipments', args.shipmentId, { status: decision.status });
		return resultOf(args.shipmentId, decision);
	},
});
