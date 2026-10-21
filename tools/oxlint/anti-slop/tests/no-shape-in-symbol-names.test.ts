import { RuleTester } from 'oxlint/plugins-dev';

import { noForbiddenTermInSymbolNamesRule } from '../rules/no-shape-in-symbol-names.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
const forbidden = { messageId: 'forbiddenSymbolName' };

tester.run('anti-slop/no-shape-in-symbol-names', noForbiddenTermInSymbolNamesRule, {
	valid: [
		// Zod owns `.shape`; reading it does not name anything in this module.
		'const fields = invoiceSchema.shape.fields.element.parse(input);',
		// Object keys satisfy the contract of whoever consumes them, such as a WGSL uniform struct.
		'uniforms(gpu, { viewport: [1, 0, 1, 0], shape: [1, 1, 0.36, 0] });',
		// A non-renamed import is declared by its source module.
		"import { Shape } from 'konva';",
		"export { shape } from './geometry';",
		// A non-renamed export repeats a name declared elsewhere.
		"import { shapeFree } from './geometry'; export { shapeFree };",
		"export { shapeFree as fields } from './geometry';",
		"export * from './geometry';",
		'const fieldSchemas: Record<string, z.ZodString> = {};',
		'const { shape: fields } = schema;',
	],
	invalid: [
		{ code: 'const metadataShape = {};', errors: [forbidden] },
		{ code: 'let shaped = expand(rows);', errors: [forbidden] },
		{ code: 'const { shape } = schema;', errors: [forbidden] },
		{ code: 'const [first, ...shapes] = rows;', errors: [forbidden] },
		{ code: 'for (const shapedPart of parts) {}', errors: [forbidden] },
		{ code: 'function normalize(shape: Row) {}', errors: [forbidden] },
		{ code: 'function buildShape() {}', errors: [forbidden] },
		{ code: 'const peak = rows.map((shape) => shape[0]);', errors: [forbidden] },
		{ code: 'try {} catch (shapeError) {}', errors: [forbidden] },
		{ code: 'class ShapeBuilder {}', errors: [forbidden] },
		{ code: 'type InvoiceShape = { readonly id: string };', errors: [forbidden] },
		{ code: 'interface RowShape { readonly id: string }', errors: [forbidden] },
		{ code: 'interface Row { readonly shape: string }', errors: [forbidden] },
		{ code: 'interface Row { reshape(value: string): void }', errors: [forbidden] },
		{ code: 'type Parse = (shape: string) => void;', errors: [forbidden] },
		{ code: 'enum Kind { Shape }', errors: [forbidden] },
		{ code: 'function parse<Shape>(value: Shape) {}', errors: [forbidden] },
		{
			code: 'class Row { shape = 1; #shapeCache = 2; reshape() {} }',
			errors: [forbidden, forbidden, forbidden],
		},
		{ code: "import { Shape as RowShape } from 'konva';", errors: [forbidden] },
		{ code: "import * as shapes from './geometry';", errors: [forbidden] },
		// Renamed and namespace exports declare a name in this module.
		{ code: 'const localX = 1; export { localX as shapeExport };', errors: [forbidden] },
		{ code: "export { localX as shapeExport } from './geometry';", errors: [forbidden] },
		{ code: "export * as shapes from './geometry';", errors: [forbidden] },
		// Method parameters are bindings too.
		{ code: 'class A { m(shapeArg) {} }', errors: [forbidden] },
		{ code: 'abstract class A { abstract m(shapeArg: string): void }', errors: [forbidden] },
	],
});
