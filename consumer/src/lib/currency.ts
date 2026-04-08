export interface MultiBalance {
  currency: string;
  name: string;
  icon: string;
  balance: number;
  earned: number;
  spent: number;
}

const currencyFallbackIcons: Record<string, string> = {
  point: "🪙",
  diamond: "💎",
  gem: "💎",
  star: "⭐",
  coin: "🪙",
  ticket: "🎟️",
  coupon: "🎫",
};

export function getCurrencyIcon(code?: string, icon?: string | null) {
  if (icon && icon.trim()) return icon;
  if (!code) return "⭐";
  return currencyFallbackIcons[code.toLowerCase()] || "⭐";
}

/**
 * Legacy helpers for screens that still fetch `/api/v1/my/balances` directly.
 * Prefer `useCurrencies()` from `@/lib/currency-context` which merges with the
 * `point_currencies` master list and uses `is_default` + `sort_order` instead
 * of hard-coding "point".
 *
 * These kept for backward compatibility; falls back to first entry when no
 * "point" row exists so they still work on tenants without a literal "point"
 * currency code.
 */
export function getPrimaryBalance(balances: MultiBalance[]) {
  if (!balances.length) return null;
  return (
    balances.find((item) => item.currency.toLowerCase() === "point") ||
    balances[0]
  );
}

export function getSecondaryBalances(balances: MultiBalance[]) {
  const primary = getPrimaryBalance(balances);
  return balances.filter((item) => item.currency !== primary?.currency);
}
