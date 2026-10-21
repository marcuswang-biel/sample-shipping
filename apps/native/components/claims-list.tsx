import { api } from '@acme/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSignOut } from '@/auth';

const currency = new Intl.NumberFormat('en-HK', { style: 'currency', currency: 'HKD' });

/** The signed-in user's claims, live from Convex (same query the web app uses). */
export function ClaimsList() {
	const claims = useQuery(api.claims.listMine);
	const viewer = useQuery(api.viewer.get);
	const signOut = useSignOut();

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.muted}>{viewer?.email ?? viewer?.subject ?? ''}</Text>
				<Pressable onPress={() => void signOut()}>
					<Text style={styles.link}>Sign out</Text>
				</Pressable>
			</View>
			{claims === undefined ? (
				<ActivityIndicator />
			) : (
				<FlatList
					data={claims}
					keyExtractor={(claim) => claim._id}
					ListEmptyComponent={<Text style={styles.muted}>No claims yet.</Text>}
					renderItem={({ item }) => (
						<View style={styles.row}>
							<Text style={styles.title}>{item.title}</Text>
							<Text style={styles.muted}>
								{currency.format(item.amountCents / 100)} · {item.status}
							</Text>
						</View>
					)}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, gap: 12 },
	header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#d4d4d4' },
	title: { fontSize: 16, fontWeight: '500' },
	muted: { color: '#737373' },
	link: { color: '#2563eb', fontWeight: '500' },
});
