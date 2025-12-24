export type MoneyParseResult =
  | { ok: true; value: number | null } // normalized dollars (2dp) or null when empty
  | { ok: false; reason: 'invalid' | 'negative' | 'not_finite' };

export function toCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function normalizeMoney(value: unknown): number | null {
  const cents = toCents(value);
  if (cents === null) return null;
  return fromCents(cents);
}

export function formatMoney(value: unknown, { zeroAsFree = false }: { zeroAsFree?: boolean } = {}): string {
  const normalized = normalizeMoney(value);
  if (normalized === null) return '$0.00';
  if (zeroAsFree && normalized === 0) return 'Free';
  return `$${normalized.toFixed(2)}`;
}

/**
 * Lenient money input parsing:
 * - Accepts "$" prefix and commas
 * - Accepts empty as null
 * - Normalizes to 2 decimals (cents)
 */
export function parseMoneyInput(raw: string): MoneyParseResult {
  const v = raw.trim();
  if (!v) return { ok: true, value: null };

  const cleaned = v.replace(/^\$/, '').replace(/,/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, reason: 'not_finite' };
  if (n < 0) return { ok: false, reason: 'negative' };
  return { ok: true, value: normalizeMoney(n) };
}


