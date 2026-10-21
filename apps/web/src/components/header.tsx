import { convexQuery } from '@convex-dev/react-query';
import { Trans } from '@lingui/react/macro';
import { api } from '@shipping/backend/convex/_generated/api';
import { Button } from '@shipping/web-ui';
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
		<header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2">
			<nav className="flex items-center gap-4 text-sm font-medium">
				<Link to="/" className="font-semibold">
					樣品寄送
				</Link>
				{isAuthenticated && (
					<Link to="/shipments" className="[&.active]:text-foreground text-muted-foreground">
						<Trans>寄送</Trans>
					</Link>
				)}
			</nav>
			<div className="flex items-center gap-3">
				{viewer.data && (
					<span className="text-muted-foreground hidden text-sm sm:inline">
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
