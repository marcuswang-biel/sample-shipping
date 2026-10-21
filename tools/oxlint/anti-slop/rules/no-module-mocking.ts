import type { ESTree, Options, Scope, SourceCode, Variable } from '@oxlint/plugins';

import { defineRule } from '@oxlint/plugins';

const moduleMockMethods = new Set(['doMock', 'mock', 'unstable_mockModule']);

function resolveVariable(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
): Variable | null {
	let scope: Scope | null = sourceCode.getScope(identifier);
	while (scope !== null) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper;
	}
	return null;
}

function importedName(node: ESTree.Node): string | null {
	if (node.type !== 'ImportSpecifier') return null;
	return node.imported.type === 'Identifier' ? node.imported.name : node.imported.value;
}

function memberName(expression: ESTree.MemberExpression): string | null {
	const property = expression.property;
	return expression.computed
		? property.type === 'Literal' && typeof property.value === 'string'
			? property.value
			: null
		: property.type === 'Identifier'
			? property.name
			: null;
}

function isTestFrameworkObject(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	let identifier: ESTree.IdentifierReference;
	let member: string | null = null;
	if (expression.type === 'Identifier') {
		identifier = expression;
	} else if (expression.type === 'MemberExpression' && expression.object.type === 'Identifier') {
		identifier = expression.object;
		member = memberName(expression);
		if (member === null) return false;
	} else {
		return false;
	}
	const variable = resolveVariable(sourceCode, identifier);
	if (variable === null || variable.defs.length === 0) {
		return member === null && (identifier.name === 'vi' || identifier.name === 'jest');
	}
	return variable.defs.some((definition) => {
		if (definition.type !== 'ImportBinding' || definition.parent?.type !== 'ImportDeclaration')
			return false;
		const source = definition.parent.source.value;
		if (definition.node.type === 'ImportNamespaceSpecifier') {
			return (
				(source === 'vitest' && (member === null || member === 'vi' || member === 'vitest')) ||
				(source === '@jest/globals' && member === 'jest')
			);
		}
		if (member !== null) return false;
		const name = importedName(definition.node);
		return (
			(source === 'vitest' && (name === 'vi' || name === 'vitest')) ||
			(source === '@jest/globals' && name === 'jest')
		);
	});
}

function ownedModulePrefixes(options: Readonly<Options>): readonly string[] | null {
	const [settings] = options;
	if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return null;
	const prefixes = settings.ownedModulePrefixes;
	if (!Array.isArray(prefixes)) return null;
	return prefixes.filter((prefix) => typeof prefix === 'string');
}

function staticSpecifier(argument: ESTree.Argument | undefined): string | null {
	if (argument === undefined) return null;
	if (argument.type === 'Literal')
		return typeof argument.value === 'string' ? argument.value : null;
	if (argument.type === 'TemplateLiteral') {
		return argument.expressions.length === 0 ? (argument.quasis[0]?.value.cooked ?? null) : null;
	}
	if (argument.type === 'ImportExpression') return staticSpecifier(argument.source);
	return null;
}

function moduleMockCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
	if (!('property' in callee) || !('object' in callee) || !('computed' in callee)) return false;
	if (!isTestFrameworkObject(sourceCode, callee.object)) return false;
	const property = callee.property;
	const method = callee.computed
		? property.type === 'Literal' &&
			(property.value === 'doMock' ||
				property.value === 'mock' ||
				property.value === 'unstable_mockModule')
			? property.value
			: null
		: property.type === 'Identifier'
			? property.name
			: null;
	return method !== null && moduleMockMethods.has(method);
}

/** Ban test framework module mocking in favor of real dependency seams. */
export const noModuleMockingRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces.',
		},
		schema: [
			{
				type: 'object',
				properties: {
					ownedModulePrefixes: { type: 'array', items: { type: 'string' }, minItems: 1 },
				},
				additionalProperties: false,
			},
		],
		messages: {
			moduleMock:
				'Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.',
		},
	},
	createOnce(context) {
		return {
			CallExpression(node) {
				if (node.callee.type === 'Super' || node.callee.type === 'V8IntrinsicExpression') return;
				if (!moduleMockCall(context.sourceCode, node.callee)) return;
				// With `ownedModulePrefixes`, only first-party specifiers are banned. A specifier
				// that is not statically known stays reported.
				const prefixes = ownedModulePrefixes(context.options);
				const specifier = staticSpecifier(node.arguments[0]);
				if (
					prefixes !== null &&
					specifier !== null &&
					!prefixes.some((prefix) => specifier.startsWith(prefix))
				)
					return;
				context.report({ node, messageId: 'moduleMock' });
			},
		};
	},
});
