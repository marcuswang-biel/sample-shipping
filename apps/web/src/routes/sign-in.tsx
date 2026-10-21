import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@acme/web-ui';
import { Trans } from '@lingui/react/macro';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import { SignInPanel } from '@/auth';
import Loader from '@/components/loader';

export const Route = createFileRoute('/sign-in')({
	component: SignInPage,
});

function SignInPage() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	if (isLoading) return <Loader />;
	if (isAuthenticated) return <Navigate to="/claims" replace />;

	return (
		<div className="flex min-h-full items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">
						<Trans>登入</Trans>
					</CardTitle>
					<CardDescription>
						<Trans>登入以使用內部系統</Trans>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<SignInPanel />
				</CardContent>
			</Card>
		</div>
	);
}
