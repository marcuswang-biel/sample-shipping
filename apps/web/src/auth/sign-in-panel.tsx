import { Button, Input, Label } from '@acme/web-ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState, type FormEvent } from 'react';

import { authClient } from './auth-client';

type Mode = 'signIn' | 'signUp';

/** Email + password sign-in, with a sign-up mode for new accounts. */
export function SignInPanel() {
	const { t } = useLingui();
	const [mode, setMode] = useState<Mode>('signIn');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setPending(true);
		setError(null);
		const result =
			mode === 'signIn'
				? await authClient.signIn.email({ email, password })
				: await authClient.signUp.email({ email, password, name: name.trim() || email });
		setPending(false);
		if (result.error) {
			setError(result.error.message ?? t`登入失敗`);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{mode === 'signUp' && (
				<div className="space-y-2">
					<Label htmlFor="sign-in-name">
						<Trans>名稱</Trans>
					</Label>
					<Input
						id="sign-in-name"
						autoComplete="name"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>
			)}
			<div className="space-y-2">
				<Label htmlFor="sign-in-email">
					<Trans>電郵</Trans>
				</Label>
				<Input
					id="sign-in-email"
					type="email"
					autoComplete="username email"
					placeholder="dev@example.com"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="sign-in-password">
					<Trans>密碼</Trans>
				</Label>
				<Input
					id="sign-in-password"
					type="password"
					autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
					minLength={8}
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
				/>
			</div>
			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}
			<Button type="submit" className="w-full" disabled={pending}>
				{mode === 'signIn' ? <Trans>登入</Trans> : <Trans>建立帳戶</Trans>}
			</Button>
			<Button
				type="button"
				variant="link"
				className="w-full"
				onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
			>
				{mode === 'signIn' ? <Trans>還沒有帳戶？建立一個</Trans> : <Trans>已有帳戶？登入</Trans>}
			</Button>
		</form>
	);
}
