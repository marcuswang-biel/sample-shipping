import type { ReactNode } from 'react';

import { Navigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import Loader from './loader';

/** Renders its children only for a signed-in user; otherwise sends them to /sign-in. */
export function RequireAuth({ children }: { children: ReactNode }) {
	const { isAuthenticated, isLoading } = useConvexAuth();
	if (isLoading) return <Loader />;
	if (!isAuthenticated) return <Navigate to="/sign-in" replace />;
	return children;
}
