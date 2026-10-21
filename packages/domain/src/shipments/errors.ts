import { Schema } from 'effect';

export class InvalidShipment extends Schema.TaggedErrorClass<InvalidShipment>()('InvalidShipment', {
	reason: Schema.String,
}) {}

export class InvalidTransition extends Schema.TaggedErrorClass<InvalidTransition>()(
	'InvalidTransition',
	{
		reason: Schema.String,
	},
) {}

export class NotOwner extends Schema.TaggedErrorClass<NotOwner>()('NotOwner', {
	reason: Schema.String,
	actorId: Schema.String,
	ownerId: Schema.String,
}) {}

export class TrackingNumberRequired extends Schema.TaggedErrorClass<TrackingNumberRequired>()(
	'TrackingNumberRequired',
	{
		reason: Schema.String,
	},
) {}

export type ShipmentError = InvalidShipment | InvalidTransition | NotOwner | TrackingNumberRequired;
