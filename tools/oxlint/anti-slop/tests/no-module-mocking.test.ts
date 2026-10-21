import { RuleTester } from 'oxlint/plugins-dev';

import { noModuleMockingRule } from '../rules/no-module-mocking.ts';

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
const owned = [{ ownedModulePrefixes: ['./', '../', '@/', '@acme/', '@acme-app/'] }];

tester.run('anti-slop/no-module-mocking', noModuleMockingRule, {
	valid: [
		"import { vi } from 'vitest'; vi.spyOn(api, 'load');",
		...[
			"import { vi } from 'vitest'; vi.mock('convex/react');",
			"import { vi } from 'vitest'; vi.mock('@tanstack/react-router', () => ({}));",
			"import { vi } from 'vitest'; vi.doMock(`lucide-react`);",
			"import { vi } from 'vitest'; vi.mock(import('convex/react'));",
			"import { vi } from 'vitest'; vi.mock('@vendor/x');",
		].map((code) => ({ code, options: owned })),
	],
	invalid: [
		"import { vi } from 'vitest'; vi.mock('convex/react');",
		...[
			"import { vi } from 'vitest'; vi.mock('../auth');",
			"import { vi } from 'vitest'; vi.mock('./sibling', () => ({}));",
			"import { vi } from 'vitest'; vi.mock('@/lib/user-session-context');",
			"import { vi } from 'vitest'; vi.doMock('@acme/shared');",
			"import { vi } from 'vitest'; vi.mock('@acme-app/routes');",
			"import { vi } from 'vitest'; vi.mock(`../lib/ai`);",
			"import { vi } from 'vitest'; vi.mock(import('../auth'));",
			"import { vi } from 'vitest'; vi.mock(specifier);",
			"import { vi } from 'vitest'; vi.mock(`${base}/x`);",
		].map((code) => ({ code, options: owned })),
	].map((test) => ({
		...(typeof test === 'string' ? { code: test } : test),
		errors: [{ messageId: 'moduleMock' }],
	})),
});
