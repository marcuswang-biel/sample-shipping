import { describe, expect, it } from 'vitest';

import { cn } from '../lib/cn';

describe('cn', () => {
	it('keeps the last of two conflicting Tailwind utilities', () => {
		expect(cn('px-2', 'px-4')).toBe('px-4');
	});

	it('drops falsy entries', () => {
		expect(cn('flex', false, undefined, 'gap-2')).toBe('flex gap-2');
	});
});
