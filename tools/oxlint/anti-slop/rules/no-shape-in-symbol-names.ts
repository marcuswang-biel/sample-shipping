import type { ESTree } from '@oxlint/plugins';

import { defineRule } from '@oxlint/plugins';

const FORBIDDEN_SYMBOL_NAME = 'shape';

type NamedNode = ESTree.Node & { name: string };
type ParameterOwner = { readonly params: readonly ESTree.ParamPattern[] };
type Member = { readonly computed: boolean; readonly key: ESTree.PropertyKey };

function containsForbiddenSymbolName(name: string): boolean {
	return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}

function bindingNames(
	pattern: ESTree.BindingPattern | ESTree.ParamPattern | ESTree.BindingRestElement,
): NamedNode[] {
	switch (pattern.type) {
		case 'Identifier':
			return [pattern];
		case 'AssignmentPattern':
			return bindingNames(pattern.left);
		case 'RestElement':
			return bindingNames(pattern.argument);
		case 'TSParameterProperty':
			return bindingNames(pattern.parameter);
		case 'ArrayPattern':
			return pattern.elements.flatMap((element) => (element === null ? [] : bindingNames(element)));
		case 'ObjectPattern':
			return pattern.properties.flatMap((property) =>
				bindingNames(property.type === 'RestElement' ? property : property.value),
			);
	}
}

function memberName(member: Member): NamedNode | null {
	if (member.computed) return null;
	return member.key.type === 'Identifier' || member.key.type === 'PrivateIdentifier'
		? member.key
		: null;
}

/**
 * Ban the case-insensitive substring "shape" in names this module declares. Names owned by other
 * modules, such as Zod's `.shape`, non-renamed imports and exports, and object keys that satisfy an external
 * contract, are checked where they are declared, not where they are used.
 */
export const noForbiddenTermInSymbolNamesRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow the case-insensitive substring "shape" in bindings, type declarations, members, and renamed imports and exports declared by the linted module.',
		},
		messages: {
			forbiddenSymbolName:
				'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
		},
	},
	createOnce(context) {
		const report = (node: NamedNode | null) => {
			if (node === null || !containsForbiddenSymbolName(node.name)) return;
			context.report({ node, messageId: 'forbiddenSymbolName', data: { name: node.name } });
		};
		const reportAll = (nodes: readonly NamedNode[]) => {
			for (const node of nodes) report(node);
		};
		const reportParameters = (node: ParameterOwner) => {
			for (const parameter of node.params) reportAll(bindingNames(parameter));
		};
		const reportFunction = (node: ESTree.Function) => {
			report(node.id);
			reportParameters(node);
		};
		const reportMember = (node: Member) => report(memberName(node));

		return {
			VariableDeclarator: (node) => reportAll(bindingNames(node.id)),
			FunctionDeclaration: (node) => reportFunction(node),
			FunctionExpression: (node) => reportFunction(node),
			TSDeclareFunction: (node) => reportFunction(node),
			TSEmptyBodyFunctionExpression: (node) => reportFunction(node),
			ArrowFunctionExpression: (node) => reportParameters(node),
			TSFunctionType: (node) => reportParameters(node),
			TSConstructorType: (node) => reportParameters(node),
			TSCallSignatureDeclaration: (node) => reportParameters(node),
			TSConstructSignatureDeclaration: (node) => reportParameters(node),
			CatchClause: (node) => {
				if (node.param !== null) reportAll(bindingNames(node.param));
			},
			ClassDeclaration: (node) => report(node.id),
			ClassExpression: (node) => report(node.id),
			TSTypeAliasDeclaration: (node) => report(node.id),
			TSInterfaceDeclaration: (node) => report(node.id),
			TSEnumDeclaration: (node) => report(node.id),
			TSEnumMember: (node) => report(node.id.type === 'Identifier' ? node.id : null),
			TSModuleDeclaration: (node) => report(node.id.type === 'Identifier' ? node.id : null),
			TSTypeParameter: (node) => report(node.name),
			TSPropertySignature: (node) => reportMember(node),
			TSMethodSignature: (node) => {
				reportMember(node);
				reportParameters(node);
			},
			PropertyDefinition: (node) => reportMember(node),
			TSAbstractPropertyDefinition: (node) => reportMember(node),
			AccessorProperty: (node) => reportMember(node),
			TSAbstractAccessorProperty: (node) => reportMember(node),
			MethodDefinition: (node) => reportMember(node),
			TSAbstractMethodDefinition: (node) => reportMember(node),
			ImportDefaultSpecifier: (node) => report(node.local),
			ImportNamespaceSpecifier: (node) => report(node.local),
			ExportSpecifier: (node) => {
				const local = node.local.type === 'Identifier' ? node.local.name : node.local.value;
				if (node.exported.type === 'Identifier' && node.exported.name !== local)
					report(node.exported);
			},
			ExportAllDeclaration: (node) => {
				if (node.exported?.type === 'Identifier') report(node.exported);
			},
			ImportSpecifier: (node) => {
				const imported =
					node.imported.type === 'Identifier' ? node.imported.name : node.imported.value;
				if (imported !== node.local.name) report(node.local);
			},
		};
	},
});
