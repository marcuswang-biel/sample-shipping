import type { Doc, Id } from '@shipping/backend/convex/_generated/dataModel';

import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { Trans, useLingui } from '@lingui/react/macro';
import { api } from '@shipping/backend/convex/_generated/api';
import { convexErrorCode } from '@shipping/shared/convex-error';
import { isAppErrorCode } from '@shipping/shared/error-codes';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@shipping/web-ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactNode } from 'react';

import Loader from '@/components/loader';
import { RequireAuth } from '@/components/require-auth';
import { SHIPMENT_ERROR_MESSAGES } from '@/features/shipments/shipment-errors';

export const Route = createFileRoute('/shipments')({
	component: () => (
		<RequireAuth>
			<ShipmentsPage />
		</RequireAuth>
	),
});

type ShipmentDoc = Doc<'shipments'>;
type FieldName = 'title' | 'recipientName' | 'trackingNumber';
type FieldErrors = Partial<Record<FieldName, string>>;

const emptyFields = { title: '', recipientName: '', trackingNumber: '' };

function ShipmentsPage() {
	const { t } = useLingui();
	const mine = useQuery(convexQuery(api.shipments.listMine, {}));
	const inTransit = useQuery(convexQuery(api.shipments.listInTransit, {}));
	const registerShipment = useConvexMutation(api.shipments.register);
	const reviseShipment = useConvexMutation(api.shipments.revise);
	const shipShipment = useConvexMutation(api.shipments.ship);
	const receiveShipment = useConvexMutation(api.shipments.receive);

	const [fields, setFields] = useState(emptyFields);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [registering, setRegistering] = useState(false);
	const [editingId, setEditingId] = useState<Id<'shipments'> | null>(null);
	const [editFields, setEditFields] = useState(emptyFields);
	const [editErrors, setEditErrors] = useState<FieldErrors>({});
	const [editError, setEditError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [busyId, setBusyId] = useState<Id<'shipments'> | null>(null);
	const [rowError, setRowError] = useState<{ id: Id<'shipments'>; message: string } | null>(null);

	const describeError = (failure: unknown) => {
		const code = convexErrorCode(failure);
		const descriptor = isAppErrorCode(code) ? SHIPMENT_ERROR_MESSAGES[code] : undefined;
		return descriptor ? t(descriptor) : t`操作失敗，請再試一次。`;
	};

	const validate = (value: typeof emptyFields): FieldErrors => {
		const errors: FieldErrors = {};
		if (value.title.trim() === '') errors.title = t`請填寫標題。`;
		else if (value.title.trim().length > 120) errors.title = t`標題最多 120 字。`;
		if (value.recipientName.trim() === '') errors.recipientName = t`請填寫收件人。`;
		else if (value.recipientName.trim().length > 120) errors.recipientName = t`收件人最多 120 字。`;
		if (value.trackingNumber.trim().length > 64) errors.trackingNumber = t`單號最多 64 字。`;
		return errors;
	};

	const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const errors = validate(fields);
		setFieldErrors(errors);
		setFormError(null);
		if (Object.keys(errors).length > 0) return;
		setRegistering(true);
		try {
			await registerShipment({
				title: fields.title,
				recipientName: fields.recipientName,
				trackingNumber: fields.trackingNumber,
			});
			setFields(emptyFields);
		} catch (failure) {
			setFormError(describeError(failure));
		} finally {
			setRegistering(false);
		}
	};

	const startEdit = (shipment: ShipmentDoc) => {
		setEditingId(shipment._id);
		setEditFields({
			title: shipment.title,
			recipientName: shipment.recipientName,
			trackingNumber: shipment.trackingNumber ?? '',
		});
		setEditErrors({});
		setEditError(null);
		setRowError(null);
	};

	const handleRevise = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!editingId) return;
		const errors = validate(editFields);
		setEditErrors(errors);
		setEditError(null);
		if (Object.keys(errors).length > 0) return;
		setSaving(true);
		try {
			await reviseShipment({ shipmentId: editingId, ...editFields });
			setEditingId(null);
		} catch (failure) {
			setEditError(describeError(failure));
		} finally {
			setSaving(false);
		}
	};

	const runRowAction = async (id: Id<'shipments'>, action: 'ship' | 'receive') => {
		setBusyId(id);
		setRowError(null);
		try {
			if (action === 'ship') await shipShipment({ shipmentId: id });
			else await receiveShipment({ shipmentId: id });
		} catch (failure) {
			setRowError({ id, message: describeError(failure) });
		} finally {
			setBusyId(null);
		}
	};

	return (
		<div className="mx-auto grid max-w-3xl gap-6 p-4 sm:p-6">
			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>登記樣品</Trans>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleRegister} className="grid gap-4" noValidate>
						<TextField
							id="shipment-title"
							label={<Trans>標題</Trans>}
							value={fields.title}
							onChange={(title) => setFields((current) => ({ ...current, title }))}
							error={fieldErrors.title}
							required
							maxLength={120}
						/>
						<TextField
							id="shipment-recipient"
							label={<Trans>收件人</Trans>}
							value={fields.recipientName}
							onChange={(recipientName) => setFields((current) => ({ ...current, recipientName }))}
							error={fieldErrors.recipientName}
							required
							maxLength={120}
						/>
						<TextField
							id="shipment-tracking"
							label={<Trans>快遞單號</Trans>}
							value={fields.trackingNumber}
							onChange={(trackingNumber) =>
								setFields((current) => ({ ...current, trackingNumber }))
							}
							error={fieldErrors.trackingNumber}
							hint={<Trans>可以先不填。填了才能寄出。</Trans>}
							maxLength={64}
						/>
						{formError ? (
							<p role="alert" className="text-destructive text-sm">
								{formError}
							</p>
						) : null}
						<Button type="submit" disabled={registering} className="w-full sm:w-fit">
							{registering ? <Trans>登記中</Trans> : <Trans>登記</Trans>}
						</Button>
					</form>
				</CardContent>
			</Card>

			<ShipmentList
				title={<Trans>我登記的</Trans>}
				pending={mine.isPending}
				failed={mine.isError}
				empty={<Trans>還沒有登記。</Trans>}
				shipments={mine.data ?? []}
				editingId={editingId}
				editFields={editFields}
				editErrors={editErrors}
				editError={editError}
				saving={saving}
				busyId={busyId}
				rowError={rowError}
				onEditFields={setEditFields}
				onStartEdit={startEdit}
				onCancelEdit={() => setEditingId(null)}
				onRevise={handleRevise}
				onShip={(id) => void runRowAction(id, 'ship')}
				onReceive={(id) => void runRowAction(id, 'receive')}
				showOwnerActions
			/>

			<ShipmentList
				title={<Trans>所有在路上的</Trans>}
				pending={inTransit.isPending}
				failed={inTransit.isError}
				empty={<Trans>現在沒有在路上的樣品。</Trans>}
				shipments={inTransit.data ?? []}
				editingId={null}
				editFields={emptyFields}
				editErrors={{}}
				editError={null}
				saving={false}
				busyId={busyId}
				rowError={rowError}
				onEditFields={setEditFields}
				onStartEdit={startEdit}
				onCancelEdit={() => setEditingId(null)}
				onRevise={handleRevise}
				onShip={(id) => void runRowAction(id, 'ship')}
				onReceive={(id) => void runRowAction(id, 'receive')}
				showOwnerActions={false}
			/>
		</div>
	);
}

function ShipmentList({
	title,
	pending,
	failed,
	empty,
	shipments,
	showOwnerActions,
	editingId,
	editFields,
	editErrors,
	editError,
	saving,
	busyId,
	rowError,
	onEditFields,
	onStartEdit,
	onCancelEdit,
	onRevise,
	onShip,
	onReceive,
}: {
	title: ReactNode;
	pending: boolean;
	failed: boolean;
	empty: ReactNode;
	shipments: ShipmentDoc[];
	showOwnerActions: boolean;
	editingId: Id<'shipments'> | null;
	editFields: typeof emptyFields;
	editErrors: FieldErrors;
	editError: string | null;
	saving: boolean;
	busyId: Id<'shipments'> | null;
	rowError: { id: Id<'shipments'>; message: string } | null;
	onEditFields: (fields: typeof emptyFields) => void;
	onStartEdit: (shipment: ShipmentDoc) => void;
	onCancelEdit: () => void;
	onRevise: (event: FormEvent<HTMLFormElement>) => void;
	onShip: (id: Id<'shipments'>) => void;
	onReceive: (id: Id<'shipments'>) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{pending ? (
					<div aria-busy="true">
						<Loader />
						<p className="sr-only">
							<Trans>載入中</Trans>
						</p>
					</div>
				) : failed ? (
					<p role="alert" className="text-destructive text-sm">
						<Trans>列表載入失敗，請再試一次。</Trans>
					</p>
				) : shipments.length > 0 ? (
					<ul className="divide-y">
						{shipments.map((shipment) => (
							<ShipmentRow
								key={shipment._id}
								shipment={shipment}
								showOwnerActions={showOwnerActions}
								editing={editingId === shipment._id}
								editFields={editFields}
								editErrors={editErrors}
								editError={editError}
								saving={saving && editingId === shipment._id}
								busy={busyId === shipment._id}
								rowError={rowError?.id === shipment._id ? rowError.message : null}
								onEditFields={onEditFields}
								onStartEdit={() => onStartEdit(shipment)}
								onCancelEdit={onCancelEdit}
								onRevise={onRevise}
								onShip={() => onShip(shipment._id)}
								onReceive={() => onReceive(shipment._id)}
							/>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground text-sm">{empty}</p>
				)}
			</CardContent>
		</Card>
	);
}

function ShipmentRow({
	shipment,
	showOwnerActions,
	editing,
	editFields,
	editErrors,
	editError,
	saving,
	busy,
	rowError,
	onEditFields,
	onStartEdit,
	onCancelEdit,
	onRevise,
	onShip,
	onReceive,
}: {
	shipment: ShipmentDoc;
	showOwnerActions: boolean;
	editing: boolean;
	editFields: typeof emptyFields;
	editErrors: FieldErrors;
	editError: string | null;
	saving: boolean;
	busy: boolean;
	rowError: string | null;
	onEditFields: (fields: typeof emptyFields) => void;
	onStartEdit: () => void;
	onCancelEdit: () => void;
	onRevise: (event: FormEvent<HTMLFormElement>) => void;
	onShip: () => void;
	onReceive: () => void;
}) {
	const formId = `shipment-edit-${shipment._id}`;
	const canShip = shipment.status === 'draft' && shipment.trackingNumber !== null;

	return (
		<li className="grid gap-3 py-3" aria-busy={busy}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<p className="truncate font-medium">{shipment.title}</p>
					<p className="text-muted-foreground text-sm">
						{shipment.recipientName} · <ShipmentStatus status={shipment.status} />
					</p>
					<p className="text-muted-foreground text-sm">
						{shipment.trackingNumber ? shipment.trackingNumber : <Trans>尚未填寫單號</Trans>}
					</p>
				</div>
				{busy ? (
					<p className="text-muted-foreground text-sm">
						<Trans>處理中</Trans>
					</p>
				) : editing ? null : (
					<div className="flex flex-wrap gap-2">
						{showOwnerActions && shipment.status !== 'received' && (
							<Button type="button" variant="outline" onClick={onStartEdit}>
								<Trans>修改</Trans>
							</Button>
						)}
						{showOwnerActions && canShip && (
							<Button type="button" onClick={onShip}>
								<Trans>寄出</Trans>
							</Button>
						)}
						{shipment.status === 'shipped' && (
							<Button type="button" onClick={onReceive}>
								<Trans>簽收</Trans>
							</Button>
						)}
					</div>
				)}
			</div>
			{showOwnerActions && shipment.status === 'draft' && shipment.trackingNumber === null && (
				<p className="text-muted-foreground text-sm">
					<Trans>填了單號才能寄出。</Trans>
				</p>
			)}
			{rowError ? (
				<p role="alert" className="text-destructive text-sm">
					{rowError}
				</p>
			) : null}
			{editing && (
				<form id={formId} onSubmit={onRevise} className="grid gap-4" noValidate>
					<TextField
						id={`${formId}-title`}
						label={<Trans>標題</Trans>}
						value={editFields.title}
						onChange={(title) => onEditFields({ ...editFields, title })}
						error={editErrors.title}
						required
						maxLength={120}
						autoFocus
					/>
					<TextField
						id={`${formId}-recipient`}
						label={<Trans>收件人</Trans>}
						value={editFields.recipientName}
						onChange={(recipientName) => onEditFields({ ...editFields, recipientName })}
						error={editErrors.recipientName}
						required
						maxLength={120}
					/>
					<TextField
						id={`${formId}-tracking`}
						label={<Trans>快遞單號</Trans>}
						value={editFields.trackingNumber}
						onChange={(trackingNumber) => onEditFields({ ...editFields, trackingNumber })}
						error={editErrors.trackingNumber}
						hint={
							shipment.status === 'shipped' ? (
								<Trans>已寄出的單號不能清空。</Trans>
							) : (
								<Trans>草稿可以清掉單號。</Trans>
							)
						}
						maxLength={64}
					/>
					{editError ? (
						<p role="alert" className="text-destructive text-sm">
							{editError}
						</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button type="submit" disabled={saving}>
							{saving ? <Trans>儲存中</Trans> : <Trans>儲存</Trans>}
						</Button>
						<Button type="button" variant="outline" onClick={onCancelEdit}>
							<Trans>取消</Trans>
						</Button>
					</div>
				</form>
			)}
		</li>
	);
}

function ShipmentStatus({ status }: { status: ShipmentDoc['status'] }) {
	if (status === 'draft') return <Trans>草稿</Trans>;
	if (status === 'shipped') return <Trans>已寄出</Trans>;
	return <Trans>已簽收</Trans>;
}

function TextField({
	id,
	label,
	value,
	onChange,
	error,
	hint,
	required = false,
	maxLength,
	autoFocus = false,
}: {
	id: string;
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	hint?: ReactNode;
	required?: boolean;
	maxLength: number;
	autoFocus?: boolean;
}) {
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
		.filter((item) => item !== undefined)
		.join(' ');

	return (
		<div className="space-y-2">
			<Label htmlFor={id}>
				{label}
				{required ? (
					<span className="text-muted-foreground font-normal">
						<Trans>（必填）</Trans>
					</span>
				) : null}
			</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				required={required}
				maxLength={maxLength}
				autoFocus={autoFocus}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy || undefined}
			/>
			{hint ? (
				<p id={hintId} className="text-muted-foreground text-xs">
					{hint}
				</p>
			) : null}
			{error ? (
				<p id={errorId} role="alert" className="text-destructive text-sm">
					{error}
				</p>
			) : null}
		</div>
	);
}
