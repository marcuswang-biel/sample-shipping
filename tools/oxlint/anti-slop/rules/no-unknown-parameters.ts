import type { ESTree, SourceCode } from '@oxlint/plugins';

import { defineRule } from '@oxlint/plugins';

type Parameter = ESTree.ParamPattern;
type ParameterOwner =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

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

function parameterName(parameter: Parameter, sourceText: string): string {
	if (parameter.type === 'TSParameterProperty') {
		return parameterName(parameter.parameter, sourceText);
	}
	if (parameter.type === 'AssignmentPattern') {
		return parameterName(parameter.left, sourceText);
	}
	if (parameter.type === 'RestElement') {
		return parameterName(parameter.argument, sourceText);
	}
	return parameter.type === 'Identifier'
		? parameter.name
		: sourceText.replace(/\s*:\s*unknown\s*$/u, '');
}

function returnPredicateNames(owner: ParameterOwner, name: string): boolean {
	const predicate = owner.returnType?.typeAnnotation;
	return (
		predicate?.type === 'TSTypePredicate' &&
		predicate.parameterName.type === 'Identifier' &&
		predicate.parameterName.name === name
	);
}

function bindingIdentifier(parameter: Parameter): ESTree.BindingIdentifier | null {
	if (parameter.type === 'TSParameterProperty') return bindingIdentifier(parameter.parameter);
	if (parameter.type === 'AssignmentPattern') return bindingIdentifier(parameter.left);
	return parameter.type === 'Identifier' ? parameter : null;
}

/**
 * The read narrows, compares or tests the raw value, or passes it to a call before anything else uses it.
 * The callee's parameter type owns the contract; if it also accepts `unknown`, this rule checks it there.
 */
function establishesContract(identifier: ESTree.Node): boolean {
	const parent = identifier.parent;
	if (parent === null) return false;
	switch (parent.type) {
		case 'UnaryExpression':
			return parent.operator === 'typeof' || parent.operator === '!';
		case 'BinaryExpression':
			return parent.operator === 'in'
				? parent.right === identifier
				: ['instanceof', '===', '!==', '==', '!='].includes(parent.operator);
		case 'CallExpression':
		case 'NewExpression':
			return parent.arguments.some((argument) => argument === identifier);
		// `log('failed', { cause, error })` hands the value to the call inside its argument.
		case 'Property':
			return (
				parent.value === identifier &&
				parent.parent?.type === 'ObjectExpression' &&
				establishesContract(parent.parent)
			);
		case 'IfStatement':
		case 'ConditionalExpression':
		case 'WhileStatement':
		case 'DoWhileStatement':
		case 'ForStatement':
			return parent.test === identifier;
		case 'SwitchStatement':
			return parent.discriminant === identifier;
		case 'LogicalExpression':
			return parent.left === identifier;
		default:
			return false;
	}
}

/**
 * A parser seam accepts `unknown` and establishes a domain contract from it: a type predicate or
 * assertion signature names the parameter, or the body's first read of it narrows it or passes it to a call.
 * An implementation that never reads the parameter is not a seam but passes nothing on either.
 */
function isParserSeam(
	sourceCode: SourceCode,
	owner: ParameterOwner,
	parameter: Parameter,
): boolean {
	const identifier = bindingIdentifier(parameter);
	if (identifier === null) return false;
	if (returnPredicateNames(owner, identifier.name)) return true;
	if (!('body' in owner) || owner.body === null || owner.body === undefined) return false;
	const variable = sourceCode
		.getDeclaredVariables(owner)
		.find((candidate) => candidate.identifiers.includes(identifier));
	if (variable === undefined) return false;
	const firstRead = variable.references
		.filter((reference) => reference.isRead())
		.toSorted((left, right) => left.identifier.start - right.identifier.start)[0];
	// A parameter the body never reads passes no value on, so nothing is left unparsed.
	return firstRead === undefined || establishesContract(firstRead.identifier);
}

/** Disallow unknown inputs outside parser seams that immediately establish a domain contract. */
export const noUnknownParametersRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow explicitly unknown function parameters outside parser seams that narrow or parse the value before any other use.',
		},
		messages: {
			unknownParameter:
				'Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.',
		},
	},
	createOnce(context) {
		const checkParameters = (node: ParameterOwner) => {
			for (const parameter of node.params) {
				const annotation = parameterAnnotation(parameter);
				if (annotation?.typeAnnotation.type !== 'TSUnknownKeyword') continue;
				if (isParserSeam(context.sourceCode, node, parameter)) continue;
				const name = parameterName(parameter, context.sourceCode.getText(parameter));
				context.report({
					node: annotation.typeAnnotation,
					messageId: 'unknownParameter',
					data: { parameter: name },
				});
			}
		};

		return {
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
