import type { ESTree, SourceCode } from '@oxlint/plugins';

import { defineRule } from '@oxlint/plugins';

import {
	isJsonParse,
	resolveVariable,
	rootIdentifier,
	untrustedSource,
} from '../shared/untrusted-input.ts';

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

const commentOwnerKinds = new Set([
	'ExpressionStatement',
	'PropertyDefinition',
	'ReturnStatement',
	'ThrowStatement',
	'VariableDeclaration',
]);

function isConstAssertion(node: TypeAssertion): boolean {
	return (
		node.typeAnnotation.type === 'TSTypeReference' &&
		node.typeAnnotation.typeName.type === 'Identifier' &&
		node.typeAnnotation.typeName.name === 'const'
	);
}

function hasSafetyComment(sourceCode: SourceCode, node: TypeAssertion): boolean {
	let current: ESTree.Node = node;
	while (true) {
		if (
			sourceCode
				.getCommentsBefore(current)
				.some((comment) => comment.end <= node.start && /\bSAFETY\s*:/u.test(comment.value))
		) {
			return true;
		}
		if (commentOwnerKinds.has(current.type) || current.parent.type === 'Program') return false;
		current = current.parent;
	}
}

/** The asserted value comes from input TypeScript cannot vouch for: `unknown`, `any`, thrown or parsed JSON. */
function crossesUntypedSeam(sourceCode: SourceCode, node: TypeAssertion): boolean {
	if (isJsonParse(node.expression)) return true;
	const root = rootIdentifier(node.expression);
	if (root === null) return false;
	const variable = resolveVariable(sourceCode, root);
	return variable !== null && untrustedSource(variable) !== null;
}

/**
 * Convex's generated `Id<'table'>` brands a string as a live document of that table. Asserting
 * one relies on an invariant that no local check establishes.
 */
function assertsConvexId(sourceCode: SourceCode, node: TypeAssertion): boolean {
	// A literal names a fixture, not a stored document, so there is no invariant to rely on.
	if (node.expression.type === 'Literal' || node.expression.type === 'TemplateLiteral')
		return false;
	const target = node.typeAnnotation;
	if (target.type !== 'TSTypeReference' || target.typeName.type !== 'Identifier') return false;
	const variable = resolveVariable(sourceCode, target.typeName);
	return (
		variable?.defs.some(
			(definition) =>
				definition.type === 'ImportBinding' &&
				definition.node.type === 'ImportSpecifier' &&
				definition.node.imported.type === 'Identifier' &&
				definition.node.imported.name === 'Id' &&
				definition.parent?.type === 'ImportDeclaration' &&
				/(^|\/)_generated\/dataModel(\.js)?$/u.test(definition.parent.source.value),
		) ?? false
	);
}

/** Require a SAFETY comment on assertions that cross an untyped seam or brand a Convex id. */
export const requireSafetyCommentForTypeAssertionRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Require a nearby SAFETY comment for type assertions over `unknown`, `any`, thrown or parsed-JSON values, and for assertions to Convex `Id` types.',
		},
		messages: {
			missingSafetyComment:
				'This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement.',
		},
	},
	createOnce(context) {
		const checkAssertion = (node: TypeAssertion) => {
			if (isConstAssertion(node) || hasSafetyComment(context.sourceCode, node)) return;
			if (
				!crossesUntypedSeam(context.sourceCode, node) &&
				!assertsConvexId(context.sourceCode, node)
			)
				return;
			context.report({ node, messageId: 'missingSafetyComment' });
		};

		return {
			TSAsExpression: checkAssertion,
			TSTypeAssertion: checkAssertion,
		};
	},
});
