import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { authClient } from './auth-client';

/** Email + password sign-in against the same Better Auth instance the web app uses. */
export function SignInScreen() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const handleSignIn = async () => {
		setPending(true);
		setError(null);
		const result = await authClient.signIn.email({ email: email.trim(), password });
		setPending(false);
		if (result.error) setError(result.error.message ?? 'Sign-in failed');
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Sign in</Text>
			<TextInput
				style={styles.input}
				placeholder="dev@example.com"
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				value={email}
				onChangeText={setEmail}
			/>
			<TextInput
				style={styles.input}
				placeholder="Password"
				secureTextEntry
				autoComplete="current-password"
				value={password}
				onChangeText={setPassword}
			/>
			{error && <Text style={styles.error}>{error}</Text>}
			<Pressable style={styles.button} onPress={() => void handleSignIn()} disabled={pending}>
				{pending ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Sign in</Text>
				)}
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
	title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
	input: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 8, padding: 12, fontSize: 16 },
	error: { color: '#dc2626' },
	button: { backgroundColor: '#171717', borderRadius: 8, padding: 14, alignItems: 'center' },
	buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
