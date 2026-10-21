import { RuleTester } from 'oxlint/plugins-dev';

import { noUnsafeDictionaryTypeRule } from '../rules/no-unsafe-dictionary-type.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
const unsafe = { messageId: 'unsafeDictionary' };

tester.run('anti-slop/no-unsafe-dictionary-type', noUnsafeDictionaryTypeRule, {
	valid: [
		'type Guard = (value: unknown) => value is Record<string, unknown>;',
		// Members and type arguments of a `satisfies` target or a constraint are not contracts either.
		'const checked = input satisfies { meta: Record<string, unknown> };',
		'function tag<T extends { meta: Record<string, unknown> }>(value: T) {}',
		// A local alias of literal keys is a closed key set.
		"type Counter = 'a' | 'b'; type Flags = Record<Counter, unknown>;",
		// Type arguments of a generic alias are resolved before the key test.
		'type Fields<T> = Record<keyof T, unknown>; let fields: Fields<{ id: string }>;',
		'type Row = { id: string }; let cells: Record<keyof Row & string, unknown>;',
		'interface Base { id: string } interface Row extends Base { name: string } type Cells = Record<keyof Row, unknown>;',
		'type Invoices = Record<string, Invoice>;',
		// The parser seam: a predicate over raw input names what it proves and nothing more.
		'const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object";',
		'function isRecord(value: unknown): value is { [key: string]: unknown } { return true; }',
		// `satisfies` checks a value without becoming its type.
		'const counters = { total: 0 } satisfies Record<string, unknown>;',
		'const counters = { total: 0 } satisfies Record<Counter, unknown>;',
		// A generic constraint keeps the caller's concrete type.
		'const stripUndefined = <T extends Record<string, unknown>>(value: T): T => value;',
		// Finite keys make an object type, not a dictionary.
		'const tip = (overrides: Partial<Record<keyof AmapTip, unknown>>) => overrides;',
		"type Flags = Record<'draft' | 'sent', unknown>;",
	],
	invalid: [
		// `keyof` an index signature or `any` is an open key set.
		{
			code: 'type Open = { [key: string]: number }; type Loose = Record<keyof Open, unknown>;',
			errors: [unsafe],
		},
		{
			code: 'interface Open { [key: string]: number } type Loose = Record<keyof Open, unknown>;',
			errors: [unsafe],
		},
		{ code: 'type Loose = Record<keyof any, unknown>;', errors: [unsafe] },
		{ code: 'type Loose = Record<keyof Record<string, number>, unknown>;', errors: [unsafe] },
		{
			code: 'interface Open { [key: string]: number } interface Wide extends Open {} type Loose = Record<keyof Wide, unknown>;',
			errors: [unsafe],
		},
		{
			code: 'type Open = { [key: string]: number }; type Loose = Record<keyof (Open & { id: string }), unknown>;',
			errors: [unsafe],
		},
		{
			code: 'type Fields<T> = Record<keyof T, unknown>; let fields: Fields<{ [key: string]: number }>;',
			errors: [unsafe],
		},
		// The open alias body is reported once; a finite key argument does not add a second report.
		{
			code: "type Container<K extends string> = Record<K, unknown>; let flags: Container<'a' | 'b'>;",
			errors: [unsafe],
		},
		{
			code: 'type Invoices = Readonly<Record<string, Record<string, unknown>>>;',
			errors: [unsafe],
		},
		{ code: 'function fieldItems(dispatch: Record<string, unknown>) {}', errors: [unsafe] },
		{ code: 'const patch: Record<string, unknown> = {};', errors: [unsafe] },
		{ code: 'const parsed = JSON.parse(text) as Record<string, unknown>;', errors: [unsafe] },
		{ code: 'interface Row { metadata?: Record<string, unknown> }', errors: [unsafe] },
		{ code: 'interface Store { [key: string]: unknown }', errors: [unsafe] },
		{ code: 'type Flags = Record<Id<"flags">, unknown>;', errors: [unsafe] },
		// A predicate over a typed value does not parse raw input; it widens a known one.
		{
			code: 'const isPlugin = (plugin: Plugin): plugin is [string, Record<string, unknown>] => true;',
			errors: [unsafe],
		},
		// Only the `satisfies` target is exempt, not an annotation on the same declaration.
		{
			code: 'const counters: Record<string, unknown> = { total: 0 } satisfies Record<string, unknown>;',
			errors: [unsafe],
		},
	],
});
