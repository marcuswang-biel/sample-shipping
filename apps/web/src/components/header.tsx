import { api } from '@acme/backend/convex/_generated/api';
import { Button } from '@acme/web-ui';
import { convexQuery } from '@convex-dev/react-query';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import { useSignOut } from '@/auth';

import { LocaleSwitcher } from './locale-switcher';

export default function Header() {
	const { isAuthenticated } = useConvexAuth();
	const viewer = useQuery({ ...convexQuery(api.viewer.get, {}), enabled: isAuthenticated });
	const signOut = useSignOut();

	return (
		<header className="flex h-14 items-center justify-between border-b px-4">
			<nav className="flex items-center gap-4 text-sm font-medium">
				<Link to="/" className="font-semibold">
					Acme
				</Link>
				{isAuthenticated && (
					<Link to="/claims" className="[&.active]:text-foreground text-muted-foreground">
						<Trans>報銷</Trans>
					</Link>
				)}
			</nav>
			<div className="flex items-center gap-3">
				{viewer.data && (
					<span className="text-muted-foreground text-sm">
						{viewer.data.email ?? viewer.data.name ?? viewer.data.subject}
					</span>
				)}
				<LocaleSwitcher />
				{isAuthenticated && (
					<Button variant="outline" size="sm" onClick={() => void signOut()}>
						<Trans>登出</Trans>
					</Button>
				)}
			</div>
		</header>
	);
}
