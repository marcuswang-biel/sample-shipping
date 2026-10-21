/**
 * Parses a user-typed amount ("12", "12.5", "12.50") into whole cents.
 * Returns `null` for anything that is not a non-negative number with at most two
 * decimals. The backend rule still validates the result; this only shapes input.
 */
export function parseAmountToCents(input: string): number | null {
	const trimmed = input.trim();
	if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
	const [whole, fraction = ''] = trimmed.split('.');
	return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

const currency = new Intl.NumberFormat('en-HK', { style: 'currency', currency: 'HKD' });

export function formatCents(cents: number): string {
	return currency.format(cents / 100);
}
