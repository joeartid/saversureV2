"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "./api";
import { isLoggedIn } from "./auth";
import { getCurrencyIcon, type MultiBalance } from "./currency";

export interface CurrencyMaster {
  id?: string;
  code: string;
  name: string;
  icon: string;
  is_default: boolean;
  sort_order: number;
  active: boolean;
}

interface CurrencyCtx {
  currencies: CurrencyMaster[];
  balances: MultiBalance[]; // merged: active master × user balance
  primary: MultiBalance | null;
  secondaries: MultiBalance[];
  loading: boolean;
  loggedIn: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<CurrencyCtx | null>(null);

function buildBalances(
  currencies: CurrencyMaster[],
  raw: MultiBalance[],
): MultiBalance[] {
  const byCode = new Map(raw.map((b) => [b.currency.toLowerCase(), b]));
  return currencies
    .filter((c) => c.active)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => {
      const existing = byCode.get(c.code.toLowerCase());
      return {
        currency: c.code,
        name: c.name || existing?.name || c.code,
        icon: getCurrencyIcon(c.code, c.icon || existing?.icon),
        balance: existing?.balance ?? 0,
        earned: existing?.earned ?? 0,
        spent: existing?.spent ?? 0,
      };
    });
}

function pickPrimary(
  currencies: CurrencyMaster[],
  balances: MultiBalance[],
): MultiBalance | null {
  if (!balances.length) return null;
  const defaultCur = currencies.find((c) => c.active && c.is_default);
  if (defaultCur) {
    const found = balances.find(
      (b) => b.currency.toLowerCase() === defaultCur.code.toLowerCase(),
    );
    if (found) return found;
  }
  return balances[0];
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencies, setCurrencies] = useState<CurrencyMaster[]>([]);
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedInState] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const masterRes = await api
        .get<{ data: CurrencyMaster[] }>("/api/v1/public/currencies")
        .catch(() => ({ data: [] as CurrencyMaster[] }));
      const master = masterRes.data ?? [];

      const isLog = isLoggedIn();
      setLoggedInState(isLog);

      let raw: MultiBalance[] = [];
      if (isLog) {
        const balRes = await api
          .get<{ data: MultiBalance[] }>("/api/v1/my/balances")
          .catch(() => ({ data: [] as MultiBalance[] }));
        raw = balRes.data ?? [];
      }

      setCurrencies(master);
      setBalances(buildBalances(master, raw));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const primary = pickPrimary(currencies, balances);
  const secondaries = primary
    ? balances.filter((b) => b.currency !== primary.currency)
    : balances;

  return (
    <Ctx.Provider
      value={{
        currencies,
        balances,
        primary,
        secondaries,
        loading,
        loggedIn,
        refresh: load,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCurrencies() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useCurrencies must be used inside <CurrencyProvider />");
  }
  return ctx;
}
