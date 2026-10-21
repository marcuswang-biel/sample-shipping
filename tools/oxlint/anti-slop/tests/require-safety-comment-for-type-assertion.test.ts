import { RuleTester } from 'oxlint/plugins-dev';

import { requireSafetyCommentForTypeAssertionRule } from '../rules/require-safety-comment-for-type-assertion.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
const missing = { messageId: 'missingSafetyComment' };
const importId = "import type { Id } from '../_generated/dataModel';\n";

tester.run(
	'anti-slop/require-safety-comment-for-type-assertion',
	requireSafetyCommentForTypeAssertionRule,
	{
		valid: [
			"const fields = ['invoiceId'] as const;",
			// Assertions between typed values need no comment; TypeScript already checks overlap.
			'function read(event: Event) { return event.target as HTMLInputElement; }',
			'function widen(row: Row) { return row as unknown; }',
			// A literal id is a fixture, not a stored document.
			`${importId}const widgetId = 'tutorial-widget' as Id<'widgets'>;`,
			`${importId}const relationId = \`relation-\${key}\` as Id<'widgetRelations'>;`,
			// An \`Id\` that is not Convex's generated brand.
			"import type { Id } from './ids'; function load(raw: string) { return raw as Id<'x'>; }",
			// Other generated types are checked structurally; only `Id` is a brand.
			"import type { Doc } from '../_generated/dataModel'; function load(row: Row) { return row as Doc<'users'>; }",
			// A stated invariant.
			`${importId}function load(raw: string) {
			// SAFETY: the query's v.id('dispatches') validator rejects foreign ids.
			return raw as Id<'dispatches'>;
		}`,
			`function parse(text: string) {
			// SAFETY: this module wrote the cursor with JSON.stringify(position).
			const position = JSON.parse(text) as Position;
			return position;
		}`,
		],
		invalid: [
			// A renamed import is still Convex's `Id`.
			{
				code: "import type { Id as UserId } from '../_generated/dataModel'; function load(raw: string) { return raw as UserId<'users'>; }",
				errors: [missing],
			},
			{
				code: `${importId}function load(raw: string) { return raw as Id<'dispatches'>; }`,
				errors: [missing],
			},
			{ code: `${importId}const id = params.id as Id<'submissions'>;`, errors: [missing] },
			{ code: 'const position = JSON.parse(text) as Position;', errors: [missing] },
			{ code: 'const parsed = JSON.parse(text); const row = parsed as Row;', errors: [missing] },
			{ code: 'function read(value: unknown) { return value as Row; }', errors: [missing] },
			{ code: 'function read(value: any) { return value.row as Row; }', errors: [missing] },
			{
				code: 'try { run(); } catch (error) { log((error as Error).message); }',
				errors: [missing],
			},
			{ code: 'function read(value: unknown) { return <Row>value; }', errors: [missing] },
			// A comment without the SAFETY marker does not count.
			{
				code: `function read(value: unknown) {
				// value is a row
				return value as Row;
			}`,
				errors: [missing],
			},
		],
	},
);
