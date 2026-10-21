import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import Loader from '@/components/loader';

export const Route = createFileRoute('/')({
	component: IndexRedirect,
});

function IndexRedirect() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	if (isLoading) return <Loader />;
	return <Navigate to={isAuthenticated ? '/claims' : '/sign-in'} replace />;
}
