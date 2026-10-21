import type { ESTree, Scope, SourceCode, Variable } from '@oxlint/plugins';

type NamedNode = ESTree.Node & { readonly name: string };

/** Where a binding's value comes from when TypeScript cannot vouch for it. */
export type UntrustedSource = 'any' | 'json' | 'thrown' | 'unknown';

type FunctionLike = ESTree.ArrowFunctionExpression | ESTree.Function;

function isFunctionLike(node: ESTree.Node): node is FunctionLike {
	return (
		node.type === 'ArrowFunctionExpression' ||
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression'
	);
}

/** The identifier an expression reads from: `error` in `error.data.code` or `(error as any).data`. */
export function rootIdentifier(expression: ESTree.Expression): NamedNode | null {
	let current: ESTree.Node = expression;
	while (true) {
		if (current.type === 'Identifier') return current;
		if (current.type === 'MemberExpression') current = current.object;
		else if (current.type === 'ChainExpression') current = current.expression;
		else if (
			current.type === 'ParenthesizedExpression' ||
			current.type === 'TSNonNullExpression' ||
			current.type === 'TSAsExpression' ||
			current.type === 'TSTypeAssertion' ||
			current.type === 'TSSatisfiesExpression'
		)
			current = current.expression;
		else return null;
	}
}

export function resolveVariable(sourceCode: SourceCode, identifier: NamedNode): Variable | null {
	let scope: Scope | null = sourceCode.getScope(identifier);
	while (scope !== null) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper;
	}
	return null;
}

export function isJsonParse(expression: ESTree.Expression | null): boolean {
	let current = expression;
	while (current?.type === 'AwaitExpression' || current?.type === 'ParenthesizedExpression') {
		current = current.type === 'AwaitExpression' ? current.argument : current.expression;
	}
	return (
		current?.type === 'CallExpression' &&
		current.callee.type === 'MemberExpression' &&
		current.callee.object.type === 'Identifier' &&
		current.callee.object.name === 'JSON' &&
		current.callee.property.type === 'Identifier' &&
		current.callee.property.name === 'parse'
	);
}

/**
 * A thrown value, an unannotated `JSON.parse` result, or a binding annotated `any` or `unknown`.
 * Globals and bindings with any other annotation or inferred type are trusted.
 */
export function untrustedSource(variable: Variable): UntrustedSource | null {
	for (const definition of variable.defs) {
		if (definition.type === 'CatchClause') return 'thrown';
		const name = definition.name;
		const annotation = 'typeAnnotation' in name ? name.typeAnnotation?.typeAnnotation.type : null;
		if (annotation === 'TSAnyKeyword') return 'any';
		if (annotation === 'TSUnknownKeyword') return 'unknown';
		if (
			definition.type === 'Variable' &&
			definition.node.type === 'VariableDeclarator' &&
			definition.node.id.type === 'Identifier' &&
			definition.node.id.typeAnnotation == null &&
			isJsonParse(definition.node.init)
		)
			return 'json';
	}
	return null;
}

/** A function that returns a type predicate or accepts `unknown` is where raw input gets parsed. */
function isParserSeam(owner: FunctionLike): boolean {
	return (
		owner.returnType?.typeAnnotation.type === 'TSTypePredicate' ||
		owner.params.some(
			(parameter) =>
				parameter.type === 'Identifier' &&
				parameter.typeAnnotation?.typeAnnotation.type === 'TSUnknownKeyword',
		)
	);
}

export function isInsideParserSeam(node: ESTree.Node): boolean {
	for (let current = node.parent; current !== null; current = current.parent) {
		if (isFunctionLike(current) && isParserSeam(current)) return true;
	}
	return false;
}
