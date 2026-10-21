import { RuleTester } from 'oxlint/plugins-dev';

import { noKnownValueWideningRule } from '../rules/no-known-value-widening.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
const widening = { messageId: 'widening' };

tester.run('anti-slop/no-known-value-widening', noKnownValueWideningRule, {
	valid: [
		"const load = () => ({ id: 'INV-1' });",
		"const labels = { HKD: 'HK$' } satisfies Record<string, string>;",
		// Keys that are not string, number or symbol make an exhaustive object, not a dictionary.
		"const CURRENCY_LABEL: Record<Currency, string> = { HKD: 'HK$', USD: 'US$' };",
		"const FLAGS: Record<'draft' | 'sent', boolean> = { draft: true, sent: false };",
		// A named alias or interface is the owner's contract.
		"type Labels = Record<string, string>; const labels: Labels = { a: 'A' };",
		"const invoice: Invoice = { id: 'INV-1' };",
		// Reassigned bindings and bindings whose properties are written are mutable state.
		"let actor: { id: string; roles?: string[] } = { id: 'a' }; actor = { id: 'b', roles: [] };",
		"const authState: { role: Role } = { role: 'admin' }; authState.role = 'shipping';",
		"const updates: { name?: string } = {}; updates.name = 'x';",
		'const counts: Record<string, number> = { a: 1 }; counts.b = 2;',
		// A return annotation that spells out an object type is the declared result contract.
		"function badge(): { label: string; variant: 'default' | 'outline' } { return { label: 'x', variant: 'default' }; }",
		"const search = (input: Input): { expand?: string } => ({ expand: 'row' });",
		// An exported function's return annotation is its public contract.
		"export function load(): Record<string, string> { return { id: 'INV-1' }; }",
		"export const load = (): unknown => ({ id: 'INV-1' });",
	],
	invalid: [
		{ code: "const load = (): unknown => ({ id: 'INV-1' });", errors: [widening] },
		{
			code: "function load(): Record<string, string> { return { id: 'INV-1' }; }",
			errors: [widening],
		},
		{ code: "const LABELS: Record<string, string> = { draft: 'Draft' };", errors: [widening] },
		{
			code: "const LABELS: Readonly<Record<string, string>> = { draft: 'Draft' };",
			errors: [widening],
		},
		{ code: "const authState: { userId: string } = { userId: 'tester' };", errors: [widening] },
		{ code: "const document: unknown = { id: 'INV-1' };", errors: [widening] },
		{ code: "const labels = { draft: 'Draft' } as Record<string, string>;", errors: [widening] },
		// Reading a property is not a write.
		{
			code: "const authState: { userId: string } = { userId: 'tester' }; use(authState.userId);",
			errors: [widening],
		},
	],
});
