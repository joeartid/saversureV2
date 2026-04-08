"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import HistoryTabs from "@/components/HistoryTabs";
import PageRenderer from "@/components/PageRenderer";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  type MultiBalance,
  getCurrencyIcon,
  getPrimaryBalance,
  getSecondaryBalances,
} from "@/lib/currency";

interface ScanEntry {
  id: string;
  scan_type: string;
  points_earned: number;
  product_name?: string;
  product_image_url?: string;
  campaign_name?: string;
  ref1?: string;
  batch_prefix?: string;
  bonus_currency?: string;
  bonus_currency_amount?: number;
  created_at: string;
}

const PAGE_SIZE = 30;

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateGroup(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "วันนี้";
  if (d.toDateString() === yesterday.toDateString()) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function getDateKey(dateStr: string) {
  return new Date(dateStr).toDateString();
}

function ScanCard({ entry }: { entry: ScanEntry }) {
  const isSuccess = entry.scan_type === "success";
  const isDuplicate = entry.scan_type.startsWith("duplicate");
  const productName = entry.product_name || entry.campaign_name || "สแกน QR";
  const codeRef = entry.ref1 || entry.batch_prefix || "";
  const hasBonusCurrency = (entry.bonus_currency_amount ?? 0) > 0 && entry.bonus_currency;
  const bonusIcon = hasBonusCurrency ? getCurrencyIcon(entry.bonus_currency) : "";

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-50 last:border-0 active:bg-gray-50 transition-all hover:bg-gray-50/50">
      {/* Product image */}
      <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-gray-50 ring-1 ring-gray-100">
        {entry.product_image_url ? (
          <Image
            src={entry.product_image_url}
            alt={productName}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" className="w-5 h-5">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{productName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {codeRef && (
            <span className="text-[10px] text-gray-400 font-mono truncate">{codeRef}</span>
          )}
          <span className="text-[10px] text-gray-300">·</span>
          <span className="text-[10px] text-gray-400">{formatTime(entry.created_at)}</span>
        </div>
      </div>

      {/* Right: badges */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        {isSuccess && entry.points_earned > 0 ? (
          <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-[12px] font-bold leading-none animate-scale-in">
            +{entry.points_earned.toLocaleString()}
          </span>
        ) : isDuplicate ? (
          <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-500 text-[11px] font-semibold leading-none">
            สแกนซ้ำ
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-[12px] font-bold leading-none animate-scale-in">
            ✓ สำเร็จ
          </span>
        )}
        {hasBonusCurrency && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[10px] font-semibold leading-none animate-scale-in">
            {bonusIcon} +{entry.bonus_currency_amount}
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100">
      <div className="w-11 h-11 rounded-xl bg-gray-100 animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
        <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/3" />
      </div>
      <div className="w-12 h-5 bg-gray-100 rounded-full animate-pulse" />
    </div>
  );
}

/**
 * HistoryFallback — original hard-coded layout kept as safety net.
 * ใช้เมื่อ page_configs ของ slug "history" ไม่มีใน DB หรือ fetch fail
 */
function HistoryFallback() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const loaderRef = useRef<HTMLDivElement>(null);
  const primaryBalance = getPrimaryBalance(balances);
  const secondaryBalances = getSecondaryBalances(balances);

  const successCount = scans.filter((s) => s.scan_type === "success").length;
  const totalPoints = scans
    .filter((s) => s.scan_type === "success")
    .reduce((sum, s) => sum + s.points_earned, 0);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) { setLoading(false); return; }

    api.get<{ data: MultiBalance[] }>("/api/v1/my/balances")
      .then((d) => setBalances(d.data ?? []))
      .catch(() => {});

    api.get<{ data: ScanEntry[]; total: number }>(`/api/v1/my/scans?limit=${PAGE_SIZE}&offset=0`)
      .then((d) => {
        setScans(d.data ?? []);
        setTotal(d.total ?? 0);
        setOffset(PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || scans.length >= total) return;
    setLoadingMore(true);
    try {
      const d = await api.get<{ data: ScanEntry[] }>(`/api/v1/my/scans?limit=${PAGE_SIZE}&offset=${offset}`);
      setScans((prev) => [...prev, ...(d.data ?? [])]);
      setOffset((o) => o + PAGE_SIZE);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, scans.length, total, offset]);

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

  // Group by date
  const groups: { label: string; items: ScanEntry[] }[] = [];
  let lastKey = "";
  for (const s of scans) {
    const key = getDateKey(s.created_at);
    if (key !== lastKey) {
      groups.push({ label: formatDateGroup(s.created_at), items: [] });
      lastKey = key;
    }
    groups[groups.length - 1].items.push(s);
  }

  return (
    <>
      {/* Header with animated gradient and floating circles */}
      <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-10 text-white relative overflow-hidden">
        <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 animate-float" />
        <div className="absolute right-8 bottom-3 h-16 w-16 rounded-full bg-white/5 animate-float-delay-1" />
        <div className="absolute left-10 bottom-0 h-10 w-10 rounded-full bg-white/8 animate-float-delay-2" />
        <h1 className="text-[40px] font-black tracking-tight leading-[1] mb-0 drop-shadow-md relative">ประวัติการสะสมแต้ม</h1>
        {loggedIn && total > 0 && (
          <p className="text-[17px] font-medium text-white/95 -mt-1.5 relative">สแกน {total} ครั้ง</p>
        )}
      </div>

      <div className="px-4 -mt-6 relative z-10 space-y-3">
        {/* Unified 4-column stat card */}
        {loggedIn && !loading && scans.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 px-4 py-3 animate-slide-up">
            <div className="flex">
              {/* Col 1: สแกนสำเร็จ */}
              <div className="flex-1 text-center animate-count-up px-1">
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight">สแกนสำเร็จ</p>
                <p className="text-[20px] font-bold text-[var(--jh-green)] leading-tight mt-0.5">{successCount.toLocaleString()}</p>
                <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-[var(--jh-green)]" />
              </div>

              <div className="w-px bg-gray-100 my-1" />

              {/* Col 2: แต้มสะสม */}
              <div className="flex-1 text-center animate-count-up px-1" style={{ animationDelay: "0.1s" }}>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight">แต้มสะสม</p>
                <p className="text-[20px] font-bold text-amber-500 leading-tight mt-0.5">{totalPoints.toLocaleString()}</p>
                <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-amber-400" />
              </div>

              <div className="w-px bg-gray-100 my-1" />

              {/* Col 3: ยอดคงเหลือ — กดไป /wallet */}
              {primaryBalance && (
                <>
                  <Link href="/wallet" className="flex-1 text-center animate-count-up px-1 group" style={{ animationDelay: "0.15s" }}>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight group-hover:text-[var(--jh-green)] transition-colors">ยอดคงเหลือ</p>
                    <p className="text-[20px] font-bold text-[var(--jh-green)] leading-tight mt-0.5">{primaryBalance.balance.toLocaleString()}</p>
                    <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-[var(--jh-green)]/40 group-hover:bg-[var(--jh-green)] transition-colors" />
                  </Link>
                  <div className="w-px bg-gray-100 my-1" />
                </>
              )}

              {/* Col 4: ทั้งหมด */}
              <div className="flex-1 text-center animate-count-up px-1" style={{ animationDelay: "0.2s" }}>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight">ทั้งหมด</p>
                <p className="text-[20px] font-bold text-blue-500 leading-tight mt-0.5">{total.toLocaleString()}</p>
                <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-blue-400" />
              </div>
            </div>

            {/* Secondary balances row (ถ้ามี เช่น เพชร) */}
            {secondaryBalances.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap gap-1.5 justify-center">
                {secondaryBalances.map((item) => (
                  <Link key={item.currency} href="/wallet" className="inline-flex items-center gap-1 rounded-full bg-gray-100 hover:bg-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 transition-colors">
                    <span>{getCurrencyIcon(item.currency, item.icon)}</span>
                    <span>{item.balance.toLocaleString()} {item.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Tab row - gamified pill style */}
        {loggedIn && <HistoryTabs />}
      </div>

      {/* List */}
      <div className="mt-3 px-4">
        {/* Not logged in */}
        {!loggedIn && (
          <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center animate-slide-up">
            <div className="w-14 h-14 mb-4 rounded-full bg-gray-100 flex items-center justify-center animate-float">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-7 h-7">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="text-[15px] font-bold text-gray-800">กรุณาเข้าสู่ระบบ</h3>
            <p className="text-[12px] text-gray-400 mt-1 mb-5 text-center">เข้าสู่ระบบเพื่อดูประวัติสะสมแต้มของคุณ</p>
            <Link href="/login" className="rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] px-7 py-2 text-[13px] font-bold text-white shadow-md shadow-green-200/50">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {/* Loading skeleton */}
        {loggedIn && loading && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {[1,2,3,4,5,6].map((n) => <SkeletonRow key={n} />)}
          </div>
        )}

        {/* Empty */}
        {loggedIn && !loading && scans.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center animate-slide-up">
            <div className="w-14 h-14 mb-4 rounded-full bg-gray-100 flex items-center justify-center animate-float">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-7 h-7">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-[15px] font-bold text-gray-800">ยังไม่มีประวัติ</h3>
            <p className="text-[12px] text-gray-400 mt-1 mb-5 text-center">สแกนคิวอาร์โค้ดบนผลิตภัณฑ์เพื่อเริ่มสะสมแต้ม</p>
            <Link href="/scan" className="rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] px-7 py-2 text-[13px] font-bold text-white shadow-md shadow-green-200/50">
              สแกนสะสมแต้ม
            </Link>
          </div>
        )}

        {/* Grouped list */}
        {loggedIn && !loading && groups.length > 0 && (
          <div className="space-y-3">
            {groups.map((group, gi) => (
              <div key={gi} className="bg-white rounded-2xl overflow-hidden shadow-sm stagger-children animate-slide-up" style={{ animationDelay: `${gi * 0.05}s` }}>
                {/* Date header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/80 border-b border-gray-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-[var(--jh-green)] shrink-0">
                    <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <p className="text-[11px] font-bold text-gray-500 tracking-wide">{group.label}</p>
                  <span className="text-[10px] text-gray-300 ml-auto bg-gray-100 px-2 py-0.5 rounded-full">{group.items.length} รายการ</span>
                </div>
                {group.items.map((entry) => (
                  <ScanCard key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll trigger */}
        {loggedIn && scans.length > 0 && (
          <div ref={loaderRef} className="py-4 text-center">
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 text-[12px] text-gray-400">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                กำลังโหลด...
              </div>
            ) : scans.length >= total ? (
              <p className="text-[10px] text-gray-300">· แสดงครบทุกรายการ ({total}) ·</p>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar />

      <div className="pt-24">
        {/* Page Builder controlled — admin จัดการได้
            ถ้า config ไม่มีใน DB → fallback ไป layout เดิม (hard-coded) */}
        <PageRenderer pageSlug="history" fallback={<HistoryFallback />} />
      </div>

      <BottomNav />
    </div>
  );
}
