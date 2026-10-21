import type { ESTree, SourceCode } from '@oxlint/plugins';

import { defineRule } from '@oxlint/plugins';

import {
	createTypeAliasEnvironment,
	resolvedTypeMatches,
	type TypeAliasEnvironment,
} from '../shared/type-alias-resolution.ts';
type ParameterOwner =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

type Parameter = ESTree.ParamPattern;

function parameterAnnotation(parameter: Parameter): ESTree.TSTypeAnnotation | null | undefined {
	if (parameter.type === 'TSParameterProperty') {
		return parameterAnnotation(parameter.parameter);
	}
	if (parameter.type === 'RestElement') {
		return parameter.typeAnnotation ?? parameterAnnotation(parameter.argument);
	}
	if (parameter.type === 'AssignmentPattern') {
		return parameter.typeAnnotation ?? parameter.left.typeAnnotation;
	}
	return parameter.typeAnnotation;
}

function parameterName(parameter: Parameter, sourceCode: SourceCode): string {
	return parameter.type === 'Identifier'
		? parameter.name
		: sourceCode.getText(parameter).replace(/\s*:\s*object\s*$/u, '');
}

/** Ban the broad object type on function inputs, including local aliases to object. */
export const noObjectParametersRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow object function parameters; inputs must use an owner-provided type and be parsed at their boundary.',
		},
		messages: {
			objectParameter:
				'Parameter `{{parameter}}` uses the broad `object` type. Accept a named owner type; parse external input at its boundary before calling this function.',
		},
	},
	createOnce(context) {
		let environment: TypeAliasEnvironment | null = null;

		const resolvesToObject = (type: ESTree.TSType): boolean =>
			environment !== null &&
			resolvedTypeMatches(type, environment, (resolved, matches) => {
				if (resolved.type === 'TSObjectKeyword') return true;
				if (resolved.type === 'TSParenthesizedType') {
					return matches(resolved.typeAnnotation);
				}
				return resolved.type === 'TSUnionType' && resolved.types.some(matches);
			});

		const checkParameters = (node: ParameterOwner) => {
			for (const parameter of node.params) {
				const annotation = parameterAnnotation(parameter);
				if (annotation === null || annotation === undefined) continue;
				if (!resolvesToObject(annotation.typeAnnotation)) continue;
				context.report({
					node: annotation.typeAnnotation,
					messageId: 'objectParameter',
					data: { parameter: parameterName(parameter, context.sourceCode) },
				});
			}
		};

		return {
			Program(node) {
				environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
			},
			ArrowFunctionExpression: checkParameters,
			FunctionDeclaration: checkParameters,
			FunctionExpression: checkParameters,
			TSCallSignatureDeclaration: checkParameters,
			TSConstructSignatureDeclaration: checkParameters,
			TSConstructorType: checkParameters,
			TSDeclareFunction: checkParameters,
			TSEmptyBodyFunctionExpression: checkParameters,
			TSFunctionType: checkParameters,
			TSMethodSignature: checkParameters,
		};
	},
});
