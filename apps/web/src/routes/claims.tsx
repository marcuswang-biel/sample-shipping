import type { Id } from '@acme/backend/convex/_generated/dataModel';

import { api } from '@acme/backend/convex/_generated/api';
import { convexErrorCode } from '@acme/shared/convex-error';
import { isAppErrorCode } from '@acme/shared/error-codes';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@acme/web-ui';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import Loader from '@/components/loader';
import { RequireAuth } from '@/components/require-auth';
import { formatCents, parseAmountToCents } from '@/features/claims/amount';
import { CLAIM_ERROR_MESSAGES } from '@/features/claims/claim-errors';

export const Route = createFileRoute('/claims')({
	component: () => (
		<RequireAuth>
			<ClaimsPage />
		</RequireAuth>
	),
});

function ClaimsPage() {
	const { t } = useLingui();
	const claims = useQuery(convexQuery(api.claims.listMine, {}));
	const submitClaim = useConvexMutation(api.claims.submit);
	const removeClaim = useConvexMutation(api.claims.remove);
	const [title, setTitle] = useState('');
	const [amount, setAmount] = useState('');
	const [error, setError] = useState<string | null>(null);

	const describeError = (failure: unknown) => {
		const code = convexErrorCode(failure);
		const descriptor = isAppErrorCode(code) ? CLAIM_ERROR_MESSAGES[code] : undefined;
		return descriptor ? t(descriptor) : t`操作失敗，請再試一次。`;
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		const amountCents = parseAmountToCents(amount);
		if (amountCents === null) {
			setError(t`金額格式不正確。`);
			return;
		}
		try {
			await submitClaim({ title, amountCents });
			setTitle('');
			setAmount('');
		} catch (failure) {
			setError(describeError(failure));
		}
	};

	const handleRemove = async (claimId: Id<'claims'>) => {
		try {
			await removeClaim({ claimId });
		} catch (failure) {
			setError(describeError(failure));
		}
	};

	return (
		<div className="mx-auto grid max-w-3xl gap-6 p-6">
			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>新增報銷</Trans>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={handleSubmit}
						className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
					>
						<div className="space-y-2">
							<Label htmlFor="claim-title">
								<Trans>標題</Trans>
							</Label>
							<Input id="claim-title" value={title} onChange={(e) => setTitle(e.target.value)} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="claim-amount">
								<Trans>金額 (HKD)</Trans>
							</Label>
							<Input
								id="claim-amount"
								inputMode="decimal"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
							/>
						</div>
						<Button type="submit">
							<Trans>提交</Trans>
						</Button>
					</form>
					{error && (
						<p role="alert" className="text-destructive mt-3 text-sm">
							{error}
						</p>
					)}
					<p className="text-muted-foreground mt-3 text-xs">
						<Trans>HK$500 或以下自動批准；每月上限 HK$5,000。</Trans>
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>我的報銷</Trans>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{claims.isPending ? (
						<Loader />
					) : claims.data && claims.data.length > 0 ? (
						<ul className="divide-y">
							{claims.data.map((claim) => (
								<li key={claim._id} className="flex items-center justify-between gap-4 py-3">
									<div className="min-w-0">
										<p className="truncate font-medium">{claim.title}</p>
										<p className="text-muted-foreground text-sm">
											{formatCents(claim.amountCents)} ·{' '}
											{claim.status === 'approved' ? <Trans>已批准</Trans> : <Trans>待審批</Trans>}
										</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										aria-label={t`刪除`}
										onClick={() => void handleRemove(claim._id)}
									>
										<Trash2 />
									</Button>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-sm">
							<Trans>還沒有報銷。</Trans>
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
