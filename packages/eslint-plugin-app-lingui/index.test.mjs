import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import plugin from './index.cjs';

function lint(code) {
	const linter = new Linter();
	linter.defineRule('app-lingui/no-t-macro-parameter', plugin.rules['no-t-macro-parameter']);
	return linter.verify(code, {
		parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		rules: { 'app-lingui/no-t-macro-parameter': 'error' },
	});
}

describe('no-t-macro-parameter', () => {
	it('rejects a Lingui t macro passed through a helper parameter', () => {
		const messages = lint(`
			import { useLingui } from '@lingui/react/macro';
			function translateStatus(t) { return t\`Ready\`; }
			export function View() {
				const { t } = useLingui();
				return translateStatus(t);
			}
		`);

		expect(messages).toHaveLength(1);
		expect(messages[0]?.ruleId).toBe('app-lingui/no-t-macro-parameter');
	});

	it('allows the macro at its Lingui call site', () => {
		const messages = lint(`
			import { useLingui } from '@lingui/react/macro';
			export function View() {
				const { t } = useLingui();
				return t\`Ready\`;
			}
		`);

		expect(messages).toHaveLength(0);
	});

	it('allows a directly imported core macro at its call site', () => {
		const messages = lint(`
			import { msg, t } from '@lingui/core/macro';
			export function translate(descriptor) {
				return [t\`Ready\`, t(descriptor), msg\`Pending\`];
			}
		`);

		expect(messages).toHaveLength(0);
	});

	it('rejects tagged and called macros bound through parameters', () => {
		const messages = lint(`
			import { t } from '@lingui/core/macro';
			function translateTag(t = null) { return t\`Ready\`; }
			function translateDescriptor({ t }, descriptor) { return t(descriptor); }
			export function run(descriptor) {
				return [translateTag(t), translateDescriptor({ t }, descriptor)];
			}
		`);

		expect(messages).toHaveLength(2);
		expect(
			messages.every((message) => message.ruleId === 'app-lingui/no-t-macro-parameter'),
		).toBe(true);
	});

	it('respects a nearer useLingui binding that shadows an outer parameter', () => {
		const messages = lint(`
			import { useLingui } from '@lingui/react/macro';
			export function wrapper(t) {
				return function View() {
					const { t } = useLingui();
					return t\`Ready\`;
				};
			}
		`);

		expect(messages).toHaveLength(0);
	});

	it('does not confuse a catch binding with an outer macro parameter', () => {
		const messages = lint(`
			import { t as coreT } from '@lingui/core/macro';
			export function wrapper(t) {
				try { return coreT\`Ready\`; }
				catch (t) { return t\`Fallback\`; }
			}
		`);

		expect(messages).toHaveLength(0);
	});

	it('does not treat an unrelated callback as a Lingui macro', () => {
		const messages = lint(`
			export function invoke(t) { return t('ready'); }
		`);

		expect(messages).toHaveLength(0);
	});

	it('does not treat Trans-only files as a source of the t macro', () => {
		const messages = lint(`
			import { Trans } from '@lingui/react/macro';
			export function invoke(t) {
				return [Trans, t('ready')];
			}
		`);

		expect(messages).toHaveLength(0);
	});
});
