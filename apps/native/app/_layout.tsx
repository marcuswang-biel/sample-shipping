import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/auth';
import { convex } from '@/lib/convex';

export default function RootLayout() {
	return (
		<AuthProvider client={convex}>
			<Stack screenOptions={{ headerTitle: 'Acme' }} />
			<StatusBar style="auto" />
		</AuthProvider>
	);
}
