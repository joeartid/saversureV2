"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  type MultiBalance,
  getCurrencyIcon,
  getPrimaryBalance,
  getSecondaryBalances,
} from "@/lib/currency";

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  currency: string;
  reference_type?: string;
  description?: string;
  created_at: string;
}

const PAGE_SIZE = 30;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEntryIcon(entry: LedgerEntry) {
  const { entry_type, reference_type } = entry;
  if (reference_type === "refund") return "↩️";
  if (reference_type === "conversion") return "🔄";
  if (entry_type === "debit") return "📤";
  if (reference_type === "promo_bonus") return "🎁";
  return "📥";
}

function getEntryLabel(entry: LedgerEntry) {
  const { entry_type, reference_type } = entry;
  if (reference_type === "refund") return "คืนแต้ม";
  if (reference_type === "conversion") return entry_type === "credit" ? "แลกเปลี่ยน (รับ)" : "แลกเปลี่ยน (ใช้)";
  if (entry_type === "debit") return "ใช้แต้ม";
  if (reference_type === "promo_bonus") return "โบนัสโปรโมชั่น";
  if (reference_type === "scan") return "สแกนสะสม";
  return entry_type === "credit" ? "ได้รับแต้ม" : "ใช้แต้ม";
}

export default function WalletPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filterCurrency, setFilterCurrency] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const primaryBalance = getPrimaryBalance(balances);
  const secondaryBalances = getSecondaryBalances(balances);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) { setLoading(false); return; }

    Promise.all([
      api.get<{ data: MultiBalance[] }>("/api/v1/my/balances"),
      api.get<{ data: LedgerEntry[] }>(`/api/v1/points/history?limit=${PAGE_SIZE}&offset=0`),
    ]).then(([bal, hist]) => {
      setBalances(bal.data ?? []);
      const entries = hist.data ?? [];
      setLedger(entries);
      setOffset(PAGE_SIZE);
      setHasMore(entries.length >= PAGE_SIZE);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const d = await api.get<{ data: LedgerEntry[] }>(`/api/v1/points/history?limit=${PAGE_SIZE}&offset=${offset}`);
      const entries = d.data ?? [];
      setLedger((prev) => [...prev, ...entries]);
      setOffset((o) => o + PAGE_SIZE);
      setHasMore(entries.length >= PAGE_SIZE);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const filteredLedger = filterCurrency
    ? ledger.filter((e) => e.currency === filterCurrency)
    : ledger;

  const allCurrencies = Array.from(new Set(ledger.map((e) => e.currency)));

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar />

      <div className="pt-24">
        {/* Hero balance card */}
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-6 pb-16 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/8" />
          <div className="absolute right-12 bottom-0 h-20 w-20 rounded-full bg-white/5" />
          <h1 className="text-[17px] font-bold relative">กระเป๋าเงิน</h1>
          <p className="text-[11px] text-white/60 mt-0.5 relative">ยอดคงเหลือทั้งหมดของคุณ</p>
        </div>

        <div className="px-4 -mt-10 relative z-10 space-y-3">
          {/* Loading skeleton */}
          {loading && (
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4 animate-pulse">
              <div className="h-10 bg-gray-100 rounded w-1/3" />
              <div className="h-6 bg-gray-100 rounded w-1/2" />
              <div className="flex gap-2">
                <div className="h-8 bg-gray-100 rounded-full flex-1" />
                <div className="h-8 bg-gray-100 rounded-full flex-1" />
              </div>
            </div>
          )}

          {/* Not logged in */}
          {!loggedIn && !loading && (
            <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center">
              <div className="w-14 h-14 mb-4 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🔒</div>
              <h3 className="text-[15px] font-bold text-gray-800">กรุณาเข้าสู่ระบบ</h3>
              <p className="text-[12px] text-gray-400 mt-1 mb-5 text-center">เข้าสู่ระบบเพื่อดูกระเป๋าเงินของคุณ</p>
              <Link href="/login" className="rounded-full bg-[var(--jh-green)] px-7 py-2 text-[13px] font-bold text-white">
                เข้าสู่ระบบ
              </Link>
            </div>
          )}

          {/* Balance cards */}
          {loggedIn && !loading && (
            <>
              {/* Primary balance */}
              {primaryBalance && (
                <div className="bg-white rounded-2xl shadow-sm p-5 relative overflow-hidden">
                  <div className="absolute -right-3 -top-3 text-[60px] opacity-[0.06] leading-none select-none">
                    {getCurrencyIcon(primaryBalance.currency, primaryBalance.icon)}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{getCurrencyIcon(primaryBalance.currency, primaryBalance.icon)}</span>
                    <span className="text-[13px] font-semibold text-gray-500">{primaryBalance.name}</span>
                  </div>
                  <p className="text-[32px] font-extrabold text-gray-900 leading-tight tracking-tight">
                    {primaryBalance.balance.toLocaleString()}
                  </p>
                  <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">สะสมทั้งหมด</p>
                      <p className="text-[14px] font-bold text-green-600">+{primaryBalance.earned.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">ใช้ไป</p>
                      <p className="text-[14px] font-bold text-gray-400">-{primaryBalance.spent.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Secondary currencies */}
              {secondaryBalances.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {secondaryBalances.map((item) => (
                    <div
                      key={item.currency}
                      className="bg-white rounded-xl shadow-sm p-4 relative overflow-hidden"
                    >
                      <div className="absolute -right-2 -top-2 text-[36px] opacity-[0.06] leading-none select-none">
                        {getCurrencyIcon(item.currency, item.icon)}
                      </div>
                      <span className="text-lg">{getCurrencyIcon(item.currency, item.icon)}</span>
                      <p className="text-[20px] font-extrabold text-gray-900 mt-1 leading-tight">
                        {item.balance.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.name}</p>
                      <div className="flex gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px]">
                        <span className="text-green-600 font-semibold">+{item.earned.toLocaleString()}</span>
                        <span className="text-gray-300">-{item.spent.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No balance state */}
              {balances.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center">
                  <div className="text-4xl mb-3">🪙</div>
                  <h3 className="text-[15px] font-bold text-gray-800">ยังไม่มียอดคงเหลือ</h3>
                  <p className="text-[12px] text-gray-400 mt-1 mb-5 text-center">สแกนคิวอาร์โค้ดเพื่อเริ่มสะสมแต้ม</p>
                  <Link href="/scan" className="rounded-full bg-[var(--jh-green)] px-7 py-2 text-[13px] font-bold text-white">
                    สแกนสะสมแต้ม
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Transaction history */}
          {loggedIn && !loading && ledger.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 mt-2">
                <h2 className="text-[14px] font-bold text-gray-800">ประวัติธุรกรรม</h2>
              </div>

              {/* Currency filter chips */}
              {allCurrencies.length > 1 && (
                <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    onClick={() => setFilterCurrency(null)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition ${
                      filterCurrency === null
                        ? "bg-[var(--jh-green)] text-white shadow-sm"
                        : "bg-white text-gray-500 border border-gray-200"
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  {allCurrencies.map((cur) => {
                    const bal = balances.find((b) => b.currency === cur);
                    return (
                      <button
                        key={cur}
                        onClick={() => setFilterCurrency(cur)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition inline-flex items-center gap-1 ${
                          filterCurrency === cur
                            ? "bg-[var(--jh-green)] text-white shadow-sm"
                            : "bg-white text-gray-500 border border-gray-200"
                        }`}
                      >
                        <span>{getCurrencyIcon(cur, bal?.icon)}</span>
                        <span>{bal?.name || cur}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Transaction list */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {filteredLedger.map((entry) => {
                  const isCredit = entry.entry_type === "credit";
                  const bal = balances.find((b) => b.currency === entry.currency);
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-gray-50 flex items-center justify-center text-lg">
                        {getEntryIcon(entry)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 leading-tight">{getEntryLabel(entry)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-gray-400">{formatDate(entry.created_at)}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">{formatTime(entry.created_at)}</span>
                          {entry.currency !== "point" && (
                            <>
                              <span className="text-[10px] text-gray-300">·</span>
                              <span className="text-[10px] text-gray-400">
                                {getCurrencyIcon(entry.currency, bal?.icon)} {bal?.name || entry.currency}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-[14px] font-bold leading-none ${isCredit ? "text-green-600" : "text-red-500"}`}>
                          {isCredit ? "+" : "-"}{entry.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-300 mt-0.5">
                          คงเหลือ {entry.balance_after.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Infinite scroll trigger */}
          {loggedIn && ledger.length > 0 && (
            <div ref={loaderRef} className="py-4 text-center">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 text-[12px] text-gray-400">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  กำลังโหลด...
                </div>
              ) : !hasMore ? (
                <p className="text-[10px] text-gray-300">· แสดงครบทุกรายการ ·</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
