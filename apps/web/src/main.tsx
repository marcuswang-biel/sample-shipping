import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';

import { AuthProvider } from '@/auth';
import { setupI18n } from '@/lib/i18n';

import { AppI18nProvider } from './components/i18n-provider';
import Loader from './components/loader';
import { routeTree } from './routeTree.gen';
import { convex } from './utils/convex';

const router = createRouter({
	routeTree,
	defaultPreload: 'intent',
	defaultPendingComponent: () => <Loader />,
	context: {},
});

// TanStack Query reads Convex through @convex-dev/react-query: queries stay live
// (Convex pushes updates) and share TanStack Query's cache and devtools.
const convexQueryClient = new ConvexQueryClient(convex);
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			queryKeyHashFn: convexQueryClient.hashFn(),
			queryFn: convexQueryClient.queryFn(),
		},
	},
});
convexQueryClient.connect(queryClient);

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

async function bootstrap() {
	await setupI18n();

	const rootElement = document.getElementById('app');
	if (!rootElement) {
		throw new Error('Root element not found');
	}

	ReactDOM.createRoot(rootElement).render(
		<AppI18nProvider>
			<AuthProvider client={convex}>
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
				</QueryClientProvider>
			</AuthProvider>
		</AppI18nProvider>,
	);
}

void bootstrap();
