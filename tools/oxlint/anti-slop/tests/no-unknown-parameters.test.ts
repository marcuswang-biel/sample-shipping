import { RuleTester } from 'oxlint/plugins-dev';

import { noUnknownParametersRule } from '../rules/no-unknown-parameters.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
const unknownParameter = { messageId: 'unknownParameter' };

tester.run('anti-slop/no-unknown-parameters', noUnknownParametersRule, {
	valid: [
		'function consume(value: Invoice) {}',
		// A type predicate or assertion signature is the contract the parser establishes.
		'const isRecord = (value: unknown): value is Record<string, unknown> => true;',
		'function invariant(condition: unknown, message: string): asserts condition {}',
		'type Guard = (value: unknown) => value is string;',
		// The first read narrows, tests or parses the raw value.
		"function amount(value: unknown) { return typeof value === 'number' ? value : 0; }",
		'function code(error: unknown) { if (error instanceof ConvexError) return error.data; return null; }',
		'function parse(value: unknown): Invoice { return invoiceSchema.parse(value); }',
		'function present(value: unknown) { return value !== undefined && value !== null; }',
		"function keyed(value: unknown) { return value !== null && 'id' in Object(value); }",
		'function canonical(value: unknown): string { if (Array.isArray(value)) return "[]"; return String(value); }',
		'function truthy(value: unknown) { if (value) return 1; return 0; }',
		'function spin(value: unknown) { while (value) break; }',
		"function kind(value: unknown) { switch (value) { case 'a': return 1; default: return 0; } }",
		'promise.catch((error: unknown) => toast.error(errorMessage(error)));',
		// Any call argument counts: the callee's parameter type owns the contract.
		'function forward(value: unknown) { sink(value); }',
		"function wrap(reason: unknown) { return new Error('failed', { cause: reason }); }",
	],
	invalid: [
		// Type-level contracts hand unparsed input to every implementation.
		{
			code: 'type SaveHandler = (id: string, value: unknown) => void;',
			errors: [unknownParameter],
		},
		{ code: 'interface Cell { onSave(value: unknown): void }', errors: [unknownParameter] },
		{ code: 'declare function save(value: unknown): void;', errors: [unknownParameter] },
		// A declaration without a body is a contract; it cannot show a parse or an unused parameter.
		{ code: 'const stub: (_ctx: unknown) => void = () => {};', errors: [unknownParameter] },
		// Passing the value through unchanged defers parsing to someone else.
		{ code: 'function keep(value: unknown) { return value; }', errors: [unknownParameter] },
		// The name `cause` no longer exempts a parameter.
		{ code: 'function keep(cause: unknown) { return cause; }', errors: [unknownParameter] },
		{ code: 'function store(value: unknown) { cache.value = value; }', errors: [unknownParameter] },
		{ code: 'function wrap(value: unknown) { return { value }; }', errors: [unknownParameter] },
		{
			code: 'function wrap(value: unknown) { const box = { value }; return box; }',
			errors: [unknownParameter],
		},
		// A predicate about another parameter does not parse this one.
		{
			code: 'function isKey(value: unknown, key: string): key is Key { cache.value = value; return true; }',
			errors: [unknownParameter],
		},
	],
});
