import { RuleTester } from 'oxlint/plugins-dev';

import { noRuntimeTypeofRule } from '../rules/no-runtime-typeof.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
const runtimeTypeof = { messageId: 'runtimeTypeof' };

tester.run('anti-slop/no-runtime-typeof', noRuntimeTypeofRule, {
	valid: [
		// Narrowing a typed union.
		"function label(value: number | undefined) { return typeof value === 'number' ? value : 0; }",
		"const name: string | undefined = read(); if (typeof name === 'string') use(name);",
		"items.map((item) => (typeof item.amount === 'number' ? item.amount : 0));",
		// Feature detection on a global.
		"if (typeof ResizeObserver === 'undefined') return;",
		"const hasWindow = typeof window !== 'undefined';",
		// Parser seams: the function accepts `unknown` or returns a type predicate.
		"function amount(value: unknown) { return typeof value === 'number' ? value : 0; }",
		"const isText = (value: unknown): value is string => typeof value === 'string';",
		"function isRecord(value: Value): value is Row { return typeof value === 'object'; }",
		"function parse(text: string) { const raw: unknown = JSON.parse(text); return decode(raw); } function decode(raw: unknown) { return typeof raw === 'object'; }",
		// A binding annotated `unknown` is parsed where it is read.
		"const value: unknown = JSON.parse(text); if (typeof value !== 'object') throw new Error('x');",
		// A thrown value handed to a parser seam.
		"try { run(); } catch (error) { const parse = (value: unknown) => typeof value === 'string'; parse(error); }",
	],
	invalid: [
		// An assertion does not hide the thrown value it reads from.
		{
			code: 'try { run(); } catch (error) { use(typeof (error as Failure).data); }',
			errors: [runtimeTypeof],
		},
		{
			code: "try { run(); } catch (error) { if (typeof error === 'string') log(error); }",
			errors: [runtimeTypeof],
		},
		{
			code: "try { run(); } catch (error) { if (error instanceof ConvexError && typeof error.data === 'string') log(error.data); }",
			errors: [runtimeTypeof],
		},
		{
			code: "const payload = JSON.parse(text); if (typeof payload.id === 'string') use(payload.id);",
			errors: [runtimeTypeof],
		},
		{
			code: 'const payload = await JSON.parse(text); use(typeof payload);',
			errors: [runtimeTypeof],
		},
		{
			code: "function read(value: any) { return typeof value === 'string'; }",
			errors: [runtimeTypeof],
		},
	],
});
