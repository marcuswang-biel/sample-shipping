'use strict';

/**
 * Lingui writing conventions for this repo (Lingui 5/6 macros):
 *
 * - JSX: <Trans>
 * - React strings: const { t } = useLingui() from @lingui/react/macro
 * - Non-React strings: import { t } from @lingui/core/macro
 * - Static maps: msg`...`, resolve with t(descriptor) at the call site
 *
 * Do not write i18n._(msg`...`). Do not call i18n._ in .tsx.
 */

function isI18nMember(node, name) {
	return (
		node &&
		node.type === 'MemberExpression' &&
		!node.computed &&
		node.property.type === 'Identifier' &&
		node.property.name === name &&
		node.object.type === 'Identifier' &&
		node.object.name === 'i18n'
	);
}

function isMsgTag(node) {
	return node && node.type === 'Identifier' && node.name === 'msg';
}

function isTIdentifier(node) {
	return node && node.type === 'Identifier' && node.name === 't';
}

function isInsideFunction(node) {
	for (let current = node.parent; current; current = current.parent) {
		if (
			current.type === 'FunctionDeclaration' ||
			current.type === 'FunctionExpression' ||
			current.type === 'ArrowFunctionExpression'
		) {
			return true;
		}
	}
	return false;
}

function isParameterBinding(context, identifier) {
	const sourceCode = context.sourceCode ?? context.getSourceCode();
	for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
		const variable = scope.set.get(identifier.name);
		if (!variable) continue;
		return variable.defs.some((definition) => definition.type === 'Parameter');
	}
	return false;
}

const plugin = {
	meta: {
		name: 'eslint-plugin-app-lingui',
	},
	rules: {
		'no-t-macro-parameter': {
			meta: {
				type: 'problem',
				docs: {
					description:
						'Do not pass a Lingui t macro into a helper because the compiler cannot transform it',
				},
				schema: [],
				messages: {
					uncompiledT:
						'Lingui t is a compile-time macro and must not be supplied as a function parameter. Return domain data or use msg descriptors, then translate at the call site.',
				},
			},
			create(context) {
				let canProduceMacroT = false;
				function reportIfParameterBound(node, callee) {
					if (!canProduceMacroT || !isTIdentifier(callee)) return;
					if (isParameterBinding(context, callee)) {
						context.report({ node, messageId: 'uncompiledT' });
					}
				}

				return {
					ImportDeclaration(node) {
						if (node.source.value === '@lingui/core/macro') {
							canProduceMacroT ||= node.specifiers.some(
								(specifier) =>
									specifier.type === 'ImportSpecifier' && specifier.imported.name === 't',
							);
						}
						if (node.source.value === '@lingui/react/macro') {
							canProduceMacroT ||= node.specifiers.some(
								(specifier) =>
									specifier.type === 'ImportSpecifier' && specifier.imported.name === 'useLingui',
							);
						}
					},
					TaggedTemplateExpression(node) {
						reportIfParameterBound(node, node.tag);
					},
					CallExpression(node) {
						reportIfParameterBound(node, node.callee);
					},
				};
			},
		},
		'no-module-scope-t': {
			meta: {
				type: 'problem',
				docs: {
					description:
						'Defer Lingui translations until after locale activation and keep them reactive',
				},
				schema: [],
				messages: {
					deferTranslation:
						'Do not call Lingui t at module scope. Use msg for a static descriptor, or move t into a function that runs after locale activation.',
				},
			},
			create(context) {
				function reportIfModuleScope(node, callee) {
					if (isTIdentifier(callee) && !isInsideFunction(node)) {
						context.report({ node, messageId: 'deferTranslation' });
					}
				}

				return {
					TaggedTemplateExpression(node) {
						reportIfModuleScope(node, node.tag);
					},
					CallExpression(node) {
						reportIfModuleScope(node, node.callee);
					},
				};
			},
		},
		'no-i18n-underscore-msg': {
			meta: {
				type: 'problem',
				docs: {
					description: 'Use t`...` instead of i18n._(msg`...`)',
				},
				schema: [],
				messages: {
					useT: 'Use t`...` (useLingui in React, @lingui/core/macro elsewhere) instead of i18n._(msg`...`).',
				},
			},
			create(context) {
				return {
					CallExpression(node) {
						if (!isI18nMember(node.callee, '_')) return;
						const [first] = node.arguments;
						if (first && first.type === 'TaggedTemplateExpression' && isMsgTag(first.tag)) {
							context.report({ node, messageId: 'useT' });
						}
					},
				};
			},
		},
		'no-i18n-underscore-in-tsx': {
			meta: {
				type: 'problem',
				docs: {
					description: 'Resolve messages with useLingui().t in .tsx files',
				},
				schema: [],
				messages: {
					useHookT:
						'In .tsx files use const { t } = useLingui() and t(...) / t`...`, not i18n._().',
				},
			},
			create(context) {
				const filename = context.filename ?? context.getFilename?.() ?? '';
				if (!filename.endsWith('.tsx')) return {};
				return {
					CallExpression(node) {
						if (isI18nMember(node.callee, '_')) {
							context.report({ node, messageId: 'useHookT' });
						}
					},
				};
			},
		},
	},
};

module.exports = plugin;
