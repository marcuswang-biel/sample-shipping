import { describe, it } from 'node:test';
import { RuleTester } from 'oxlint/plugins-dev';

import { noConditionalEmptyObjectSpreadRule } from '../rules/no-conditional-empty-object-spread.ts';
import { noKnownValueWideningRule } from '../rules/no-known-value-widening.ts';
import { noModuleMockingRule } from '../rules/no-module-mocking.ts';
import { noObjectParametersRule } from '../rules/no-object-parameters.ts';
import { noUnknownReturnsRule } from '../rules/no-unknown-returns.ts';
import { noUnknownTypeAliasesRule } from '../rules/no-unknown-type-aliases.ts';
import { noWidenThenAssertRule } from '../rules/no-widen-then-assert.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

tester.run('#526.1 parenthesized conditional branches', noConditionalEmptyObjectSpreadRule, {
	valid: ['const result = { ...(cond ? ({ a: 1 }) : ({ b: 2 })) };'],
	invalid: [
		'const result = { ...(cond ? ({}) : { a: 1 }) };',
		'const result = { ...(cond ? { a: 1 } : (({}))) };',
	].map((code) => ({ code, errors: [{ messageId: 'avoid' }] })),
});

tester.run('#526.2 lexical type binders', noObjectParametersRule, {
	valid: [
		'type Input = object; function outer() { interface Input { id: string } function consume(value: Input) {} }',
		'type Input = object; function outer() { enum Input { First } function consume(value: Input) {} }',
		'type Input = object; function outer() { class Input { id = 1 } function consume(value: Input) {} }',
		'type Input = object; const C = class Input { consume(value: Input) {} };',
		'type Input = object; type F<T> = T extends infer Input ? (value: Input) => void : never;',
		'type Identity<T> = T; function consume(value: Identity<{ id: string }>) {}',
		'type Input = object; type Map = { [Input in string]: (value: Input) => void };',
		'type Input = object; namespace Local { import Input = Models.Input; function consume(value: Input) {} }',
		'type Input = object; switch (mode) { case 1: interface Input { id: string } function consume(value: Input) {} }',
	],
	invalid: [
		{
			code: 'type Identity<T> = T; function consume(value: Identity<object>) {}',
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: 'type Input = object; type F<T> = T extends (T extends infer Input ? string : number) ? (value: Input) => void : never;',
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: 'type Input = object; const C = class Input {}; function consume(value: Input) {}',
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: 'type Input = object; type F<T> = T extends infer Input ? never : (value: Input) => void;',
			errors: [{ messageId: 'objectParameter' }],
		},
		{
			code: 'type Input = object; function outer() { interface Input { id: string } } function consume(value: Input) {}',
			errors: [{ messageId: 'objectParameter' }],
		},
	],
});

tester.run('alias arguments stay in their declaration scope', noObjectParametersRule, {
	valid: [
		'type T = string; type N = T; type A<T> = N; declare function f(value: A<object>): void;',
		'type T = object; function outer<T>() { type N = T; type A<U> = N; const f = (value: A<object>) => value; }',
		'type Inner<U> = U; type Outer<T> = Inner<T>; declare function f(value: Outer<string>): void;',
		'type Pair<T, U = T> = U; declare function f(value: Pair<string>): void;',
	],
	invalid: [
		'type T = object; type N = T; type A<T> = N; declare function f(value: A<string>): void;',
		'type Inner<U> = U; type Outer<T> = Inner<T>; declare function f(value: Outer<object>): void;',
		'type Pair<T, U = T> = U; declare function f(value: Pair<object>): void;',
	].map((code) => ({ code, errors: [{ messageId: 'objectParameter' }] })),
});

tester.run('alias return arguments do not replace unrelated bindings', noUnknownReturnsRule, {
	valid: [
		'type T = string; type N = T; type A<T> = N; declare function f(): A<unknown>;',
		'type Inner<U> = Promise<U>; type Outer<T> = Inner<T>; declare function f(): Outer<string>;',
	],
	invalid: [
		'type T = unknown; type N = T; type A<T> = N; declare function f(): A<string>;',
		'type Inner<U> = Promise<U>; type Outer<T> = Inner<T>; declare function f(): Outer<unknown>;',
		'type Pair<T, U = T> = Promise<U>; declare function f(): Pair<unknown>;',
	].map((code) => ({ code, errors: [{ messageId: 'unknownReturn' }] })),
});

tester.run('#526.3 namespace module mocking', noModuleMockingRule, {
	valid: [
		"import * as vi from 'other'; vi.mock('x');",
		"import * as vitest from 'vitest'; vitest.other.mock('x');",
		"import * as vitest from 'vitest'; vitest[key].mock('x');",
		"import * as globals from '@jest/globals'; globals.other.mock('x');",
		"import * as vitest from 'vitest'; function f(vitest: Api) { vitest.vi.mock('x'); }",
	],
	invalid: [
		"import * as vi from 'vitest'; vi.mock('x');",
		"import * as vitest from 'vitest'; vitest.vi.mock('x');",
		"import * as globals from '@jest/globals'; globals.jest.mock('x');",
		"import * as vitest from 'vitest'; vitest['vi']['mock']('x');",
		"import { vi as mocker } from 'vitest'; mocker.mock('x');",
	].map((code) => ({ code, errors: [{ messageId: 'moduleMock' }] })),
});

tester.run('#526.4 Promise shadowing', noUnknownReturnsRule, {
	valid: [
		'type Promise<T> = { value: T }; function load(): Promise<unknown> { return value; }',
		'interface Promise<T> { value: T } function load(): Promise<unknown> { return value; }',
		'class Promise<T> { value: T } function load(): Promise<unknown> { return value; }',
		'function load<Promise>(): Promise<unknown> { return value; }',
		"import type { Promise } from 'other'; function load(): Promise<unknown> { return value; }",
		'type PromiseLike<T> = { value: T }; function load(): PromiseLike<unknown> { return value; }',
	],
	invalid: [
		'function load(): Promise<unknown> { return value; }',
		'function load(): PromiseLike<unknown> { return value; }',
		'type Promise = unknown; function load(): Promise { return value; }',
		'type Promise<T> = unknown; function load(): Promise<string> { return value; }',
		'type Promise<T> = T; function load(): Promise<unknown> { return value; }',
		'type Box<T> = Promise<T>; function load(): Box<unknown> { return value; }',
		'function outer() { interface Promise<T> { value: T } } function load(): Promise<unknown> { return value; }',
	].map((code) => ({ code, errors: [{ messageId: 'unknownReturn' }] })),
});

tester.run('#526.5 narrow declaration wins', noWidenThenAssertRule, {
	valid: [
		'type MyType = { id: string }; declare const src: MyType; const w: MyType = src as unknown; const result = w as MyType;',
	],
	invalid: [
		{
			code: 'type MyType = { id: string }; declare const src: MyType; const w = src as unknown; const result = w as MyType;',
			errors: [{ messageId: 'widenThenAssert' }],
		},
	],
});

tester.run('#526.6 finite mapped keys and #526.7 broad key unions', noKnownValueWideningRule, {
	valid: [
		"const load = (): { [K in 'a' | 'b']: number } => ({ a: 1, b: 2 });",
		"type Result = { [K in 'a' | 'b']: number }; const load = (): Result => ({ a: 1, b: 2 });",
		// A named alias is the owner's contract (#401), whatever its keys.
		"type Result = { [K in 'a' | string]: number }; const load = (): Result => ({ a: 1 });",
	],
	invalid: ["const load = (): { [K in 'a' | string]: number } => ({ a: 1 });"].map((code) => ({
		code,
		errors: [{ messageId: 'widening' }],
	})),
});

// The resolver is shared with a rule already enabled in the root config.
tester.run('retained aliases keep lexical and generic bindings', noUnknownTypeAliasesRule, {
	valid: ['type Identity<T> = T; type Named = Identity<string>;', 'type Cycle = Cycle;'],
	invalid: [
		{
			code: 'type Raw = unknown; function outer() { interface Raw { id: string } type Named = Raw; }',
			errors: [{ messageId: 'unknownAlias' }],
		},
		{
			code: 'type Raw = unknown; function outer() { enum Raw { First } type Named = Raw; }',
			errors: [{ messageId: 'unknownAlias' }],
		},
		{
			code: 'type Identity<T> = T; type Raw = Identity<unknown>;',
			errors: [{ messageId: 'unknownAlias' }],
		},
		{
			code: 'type Raw = unknown; const C = class Raw {}; type Alias = Raw;',
			errors: [{ messageId: 'unknownAlias' }, { messageId: 'unknownAlias' }],
		},
	],
});
