import { RuleTester } from 'oxlint/plugins-dev';

import { noChainedTypeAssertionsRule } from '../rules/no-chained-type-assertions.ts';
import { noObjectParametersRule } from '../rules/no-object-parameters.ts';
import { noReflectApplyRule } from '../rules/no-reflect-apply.ts';
import { noReflectGetRule } from '../rules/no-reflect-get.ts';
import { noUnknownReturnsRule } from '../rules/no-unknown-returns.ts';
import { noUnknownTypeAliasesRule } from '../rules/no-unknown-type-aliases.ts';
import { noWidenThenAssertRule } from '../rules/no-widen-then-assert.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

tester.run('anti-slop/no-chained-type-assertions', noChainedTypeAssertionsRule, {
	valid: [
		'const parsed = input as { readonly invoiceId: string };',
		"const fields = ['invoiceId'] as const;",
	],
	invalid: [
		{
			code: 'const parsed = (input as unknown) as { readonly invoiceId: string };',
			errors: [{ messageId: 'chained' }],
		},
	],
});

tester.run('anti-slop/no-object-parameters', noObjectParametersRule, {
	valid: [
		'type Alias = object;',
		'interface Owner { readonly id: string } function consume(value: Owner) {}',
		'function consume<Value extends object>(value: Value) {}',
		'type Input = object; function consume<Input>(value: Input) {}',
		`type Input = object;
		 function outer() {
			 type Input = { readonly id: string };
			 function consume(value: Input) {}
		 }`,
		`function outer() {
			 type Input = object;
		 }
		 function sibling(value: Input) {}`,
	],
	invalid: [
		{ code: 'function consume(value: object) {}', errors: [{ messageId: 'objectParameter' }] },
		{
			code: 'type Input = object; function consume(value: Input) {}',
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: `function consume(value: Input) {}
			 type Input = object;`,
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: `function outer() {
			 type Input = object;
			 type Alias = Input;
			 const consume = (value: Alias) => {};
		 }`,
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: 'type Input = object; interface Consumer { consume(value: Input): void }',
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: 'type Input = object; declare function consume(value: Input): void;',
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: `namespace Contracts {
			 type Input = object;
			 export function consume(value: Input) {}
		 }`,
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: 'type Input = object; function consume(value: Input): void; function consume(value: Input) {}',
			errors: [{ messageId: 'objectParameter' }, { messageId: 'objectParameter' }],
		},
	],
});

tester.run('anti-slop/no-reflect-apply', noReflectApplyRule, {
	valid: [
		'const value = operation.apply(owner, args);',
		'Reflect.get(owner, key);',
		'const Reflect = { apply() { return 1; } }; Reflect.apply();',
		'function invoke(Reflect: { apply(): number }) { return Reflect.apply(); }',
	],
	invalid: [
		{
			code: 'const value = Reflect.apply(operation, owner, args);',
			errors: [{ messageId: 'reflectApply' }],
		},
		{
			code: "const value = Reflect['apply'](operation, owner, args);",
			errors: [{ messageId: 'reflectApply' }],
		},
	],
});

tester.run('anti-slop/no-reflect-get', noReflectGetRule, {
	valid: [
		'const value = owner.property;',
		'const value = owner[key];',
		'Reflect.set(owner, key, value);',
		'const Reflect = { get() { return 1; } }; Reflect.get();',
		'function read(Reflect: { get(): number }) { return Reflect.get(); }',
	],
	invalid: [
		{
			code: 'const value = Reflect.get(owner, key);',
			errors: [{ messageId: 'reflectGet' }],
		},
		{
			code: "const value = Reflect['get'](owner, key);",
			errors: [{ messageId: 'reflectGet' }],
		},
	],
});

tester.run('anti-slop/no-unknown-returns', noUnknownReturnsRule, {
	valid: [
		'function parse(): User { return user; }',
		'function infer() { return input; }',
		'function generic<Value>(): Value { return value; }',
		'type Result = unknown; function generic<Result>(): Result { return value; }',
		'type Result = { value: unknown }; function load(): Result { return result; }',
		`type Result = unknown;
		 function outer() {
			 type Result = { readonly invoiceId: string };
			 function load(): Result { return result; }
		 }`,
	],
	invalid: [
		{
			code: 'function load(): unknown { return input; }',
			errors: [{ messageId: 'unknownReturn' }],
		},
		{ code: 'type Loader = () => unknown;', errors: [{ messageId: 'unknownReturn' }] },
		{
			code: `function load(): Result { return result; }
			 type Raw = unknown;
			 type Result = Promise<Raw>;`,
			errors: [{ messageId: 'unknownReturn' }],
		},
		{
			code: `function outer() {
			 type Raw = unknown;
			 type Result = Raw;
			 function load(): Result { return result; }
		 }`,
			errors: [{ messageId: 'unknownReturn' }],
		},
		{
			code: `namespace Contracts {
			 type Result = unknown;
			 export function load(): Result { return result; }
		 }`,
			errors: [{ messageId: 'unknownReturn' }],
		},
	],
});

tester.run('anti-slop/no-unknown-type-aliases', noUnknownTypeAliasesRule, {
	valid: [
		'type User = { readonly id: string };',
		'type Alias = string; type UserId = Alias;',
		'type Generic<Value> = Value;',
	],
	invalid: [
		{ code: 'type Alias = unknown;', errors: [{ messageId: 'unknownAlias' }] },
		{
			code: 'type Raw = unknown; type Parsed = Raw;',
			errors: [{ messageId: 'unknownAlias' }, { messageId: 'unknownAlias' }],
		},
		{
			code: `function scope() {
			 type Raw = unknown;
			 type Parsed = Raw;
		 }`,
			errors: [{ messageId: 'unknownAlias' }, { messageId: 'unknownAlias' }],
		},
		{
			code: `namespace Contracts {
			 type Payload = unknown;
		 }`,
			errors: [{ messageId: 'unknownAlias' }],
		},
		{
			code: 'type Payload = string | unknown;',
			errors: [{ messageId: 'unknownAlias' }],
		},
		{
			code: `type External = unknown;
			 function scope<External>() {
			 type Alias = External;
		 }`,
			errors: [{ messageId: 'unknownAlias' }],
		},
	],
});

tester.run('anti-slop/no-widen-then-assert', noWidenThenAssertRule, {
	valid: [
		"const source = { id: 'first' }; const widened: unknown = source;",
		'declare const input: unknown; const parsed = input as { readonly id: string };',
		"const draft = { invoiceId: 'INV-1' } satisfies { invoiceId: string };",
	],
	invalid: [
		{
			code: "const source = { id: 'second' }; const widened: unknown = source; const parsed = widened as { readonly id: string };",
			errors: [{ messageId: 'widenThenAssert' }],
		},
	],
});
