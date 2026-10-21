import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';

import Header from '@/components/header';

import '../index.css';

export type RouterAppContext = Record<string, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [{ title: 'Acme' }],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<div className="grid h-svh grid-rows-[auto_minmax(0,1fr)]">
				<Header />
				<main className="min-h-0 overflow-auto">
					<Outlet />
				</main>
			</div>
		</>
	);
}
