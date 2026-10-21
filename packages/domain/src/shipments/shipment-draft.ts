import { Schema, SchemaTransformation } from 'effect';

export const Shipment_TITLE_MAX_LENGTH = 120;

export const Shipment_RECIPIENT_NAME_MAX_LENGTH = 120;

export const Shipment_TRACKING_NUMBER_MAX_LENGTH = 64;

export const ShipmentDraft = Schema.Struct({
	title: Schema.String.pipe(Schema.decode(SchemaTransformation.trim())).check(
		Schema.isMinLength(1),
		Schema.isMaxLength(Shipment_TITLE_MAX_LENGTH),
	),
	recipientName: Schema.String.pipe(Schema.decode(SchemaTransformation.trim())).check(
		Schema.isMinLength(1),
		Schema.isMaxLength(Shipment_RECIPIENT_NAME_MAX_LENGTH),
	),
	trackingNumber: Schema.String.pipe(Schema.decode(SchemaTransformation.trim())).check(
		Schema.isMaxLength(Shipment_TRACKING_NUMBER_MAX_LENGTH),
	),
});

export type ShipmentDraft = typeof ShipmentDraft.Type;

export type ShipmentRequest = typeof ShipmentDraft.Encoded;
