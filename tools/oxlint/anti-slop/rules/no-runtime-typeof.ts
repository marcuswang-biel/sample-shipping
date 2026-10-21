import { defineRule } from '@oxlint/plugins';

import {
	isInsideParserSeam,
	resolveVariable,
	rootIdentifier,
	untrustedSource,
} from '../shared/untrusted-input.ts';

/** Disallow ad hoc `typeof` parsing of untrusted input outside a parser seam. */
export const noRuntimeTypeofRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow `typeof` checks on thrown values, unchecked `JSON.parse` results and `any` bindings outside a parser seam; decode them at their I/O boundary.',
		},
		messages: {
			runtimeTypeof:
				'A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.',
		},
	},
	createOnce(context) {
		return {
			UnaryExpression(node) {
				if (node.operator !== 'typeof') return;
				const root = rootIdentifier(node.argument);
				if (root === null) return;
				const variable = resolveVariable(context.sourceCode, root);
				if (variable === null) return;
				// A binding annotated `unknown` declares that it is parsed where it is read.
				const source = untrustedSource(variable);
				if (source === null || source === 'unknown') return;
				if (isInsideParserSeam(node)) return;
				context.report({ node, messageId: 'runtimeTypeof' });
			},
		};
	},
});
