import { describe, expect, it } from 'vitest';

import { parseAmountToCents } from '../amount';

describe('parseAmountToCents', () => {
	it('parses whole and decimal amounts without float error', () => {
		expect(parseAmountToCents('12')).toBe(1_200);
		expect(parseAmountToCents('12.5')).toBe(1_250);
		expect(parseAmountToCents(' 0.29 ')).toBe(29);
	});

	it('rejects more than two decimals, signs and text', () => {
		expect(parseAmountToCents('1.005')).toBeNull();
		expect(parseAmountToCents('-3')).toBeNull();
		expect(parseAmountToCents('abc')).toBeNull();
		expect(parseAmountToCents('')).toBeNull();
	});
});
