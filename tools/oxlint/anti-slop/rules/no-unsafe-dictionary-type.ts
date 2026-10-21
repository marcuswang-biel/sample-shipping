import type { ESTree } from '@oxlint/plugins';

import { defineRule } from '@oxlint/plugins';

import {
	classifyUnsafeDictionary,
	classifyUnsafeDictionaryValue,
	createTypeEnvironment,
	type TypeEnvironment,
} from '../shared/dictionary-types.ts';

const typeNodeKinds: ReadonlySet<string> = new Set([
	'JSDocNonNullableType',
	'JSDocNullableType',
	'JSDocUnknownType',
	'TSAnyKeyword',
	'TSArrayType',
	'TSBigIntKeyword',
	'TSBooleanKeyword',
	'TSConditionalType',
	'TSConstructorType',
	'TSFunctionType',
	'TSImportType',
	'TSIndexedAccessType',
	'TSInferType',
	'TSIntersectionType',
	'TSIntrinsicKeyword',
	'TSLiteralType',
	'TSMappedType',
	'TSNamedTupleMember',
	'TSNeverKeyword',
	'TSNullKeyword',
	'TSNumberKeyword',
	'TSObjectKeyword',
	'TSParenthesizedType',
	'TSStringKeyword',
	'TSSymbolKeyword',
	'TSTemplateLiteralType',
	'TSThisType',
	'TSTupleType',
	'TSTypeLiteral',
	'TSTypeOperator',
	'TSTypePredicate',
	'TSTypeQuery',
	'TSTypeReference',
	'TSUndefinedKeyword',
	'TSUnionType',
	'TSUnknownKeyword',
	'TSVoidKeyword',
]);

function isTypeNode(node: ESTree.Node): node is ESTree.TSType {
	return typeNodeKinds.has(node.type);
}

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
	return type.typeName.type === 'Identifier' ? type.typeName.name : null;
}

function isInsideTypeAliasDeclaration(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && current.type !== 'Program') {
		if (current.type === 'TSTypeAliasDeclaration') return true;
		current = current.parent;
	}
	return false;
}

function isPlainAliasConsumerUse(node: ESTree.TSType, environment: TypeEnvironment): boolean {
	if (node.type !== 'TSTypeReference' || node.typeArguments?.params.length) return false;
	const name = typeReferenceName(node);
	return name !== null && environment.aliases.has(name) && !isInsideTypeAliasDeclaration(node);
}

type FunctionLike =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

function isFunctionLike(node: ESTree.Node): node is FunctionLike {
	return (
		node.type === 'ArrowFunctionExpression' ||
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression' ||
		node.type === 'TSDeclareFunction' ||
		node.type === 'TSEmptyBodyFunctionExpression' ||
		node.type === 'TSMethodSignature' ||
		node.type === 'TSFunctionType'
	);
}

/** `(value: unknown): value is Record<string, unknown>` is the parser seam that inspects raw input. */
function isUnknownInputPredicate(predicate: ESTree.TSTypePredicate): boolean {
	if (predicate.parameterName.type !== 'Identifier') return false;
	const name = predicate.parameterName.name;
	const owner = predicate.parent.parent;
	if (owner === null || !isFunctionLike(owner) || owner.returnType !== predicate.parent)
		return false;
	return owner.params.some(
		(parameter) =>
			parameter.type === 'Identifier' &&
			parameter.name === name &&
			parameter.typeAnnotation?.typeAnnotation.type === 'TSUnknownKeyword',
	);
}

/** Nodes inside a type that are not types themselves: annotations, members and type arguments. */
const TYPE_CONTEXT_KINDS: ReadonlySet<string> = new Set([
	'TSTypeAnnotation',
	'TSPropertySignature',
	'TSIndexSignature',
	'TSTypeParameterInstantiation',
]);

/**
 * A `satisfies` target checks a value without becoming its type, and a generic constraint keeps the
 * caller's concrete type. Neither hands callers a dictionary contract.
 */
function isOutsideContract(node: ESTree.Node): boolean {
	let child: ESTree.Node = node;
	let current: ESTree.Node | null = node.parent;
	while (current !== null && current.type !== 'Program') {
		if (current.type === 'TSSatisfiesExpression') return current.typeAnnotation === child;
		if (current.type === 'TSTypeParameter') return current.constraint === child;
		if (current.type === 'TSTypePredicate') return isUnknownInputPredicate(current);
		if (!isTypeNode(current) && !TYPE_CONTEXT_KINDS.has(current.type)) return false;
		child = current;
		current = current.parent;
	}
	return false;
}

function shouldReportType(
	node: ESTree.TSType,
	environment: TypeEnvironment,
	classify: (candidate: ESTree.TSType) => ReturnType<typeof classifyUnsafeDictionary>,
): boolean {
	if (isPlainAliasConsumerUse(node, environment) || isOutsideContract(node)) return false;
	if (classify(node) === null) return false;
	let current: ESTree.Node | null = node.parent;
	while (current !== null && current.type !== 'Program') {
		if (isTypeNode(current) && classify(current) !== null) return false;
		current = current.parent;
	}
	return true;
}

/**
 * Disallow object-dictionary contracts whose direct value type is an unsafe escape hatch. Parser
 * seams over `unknown`, `satisfies` checks and generic constraints are not contracts.
 */
export const noUnsafeDictionaryTypeRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow object-dictionary contracts whose direct value type is unknown, any, object, {}, or a union/alias containing one of those escape hatches.',
		},
		messages: {
			unsafeDictionary:
				"This dictionary's {{value}} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion.",
		},
	},
	createOnce(context) {
		let environment: TypeEnvironment | null = null;
		const classificationCache = new WeakMap<
			ESTree.TSType,
			ReturnType<typeof classifyUnsafeDictionary>
		>();
		const classify = (node: ESTree.TSType) => {
			const cached = classificationCache.get(node);
			if (cached !== undefined) return cached;
			if (environment === null) return null;
			const result = classifyUnsafeDictionary(node, environment);
			classificationCache.set(node, result);
			return result;
		};
		const report = (node: ESTree.Node, value: string) => {
			context.report({ node, messageId: 'unsafeDictionary', data: { value } });
		};
		const reportIfUnsafe = (node: ESTree.TSType) => {
			if (environment === null || !shouldReportType(node, environment, classify)) return;
			const unsafe = classify(node);
			if (unsafe === null) return;
			report(node, unsafe.unsafeValue);
		};

		return {
			Program(node) {
				environment = createTypeEnvironment(node);
			},
			TSTypeReference: reportIfUnsafe,
			TSTypeLiteral: reportIfUnsafe,
			TSMappedType: reportIfUnsafe,
			TSIndexSignature(node) {
				if (
					environment === null ||
					node.typeAnnotation === null ||
					node.parent.type === 'TSTypeLiteral'
				)
					return;
				const unsafe = classifyUnsafeDictionaryValue(
					node.typeAnnotation.typeAnnotation,
					environment,
				);
				if (unsafe !== null) report(node, unsafe.unsafeValue);
			},
		};
	},
});
