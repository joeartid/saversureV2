"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  type MultiBalance,
  getCurrencyIcon,
  getPrimaryBalance,
  getSecondaryBalances,
} from "@/lib/currency";

interface Props {
  show_success_count?: boolean;
  show_total_points?: boolean;
  show_balance?: boolean;
  show_total_scans?: boolean;
  balance_link?: string;
}

interface ScanEntry {
  scan_type: string;
  points_earned: number;
}

interface ScansResponse {
  data?: ScanEntry[];
  total?: number;
}

export default function HistoryStatSummary({
  show_success_count = true,
  show_total_points = true,
  show_balance = true,
  show_total_scans = true,
  balance_link = "/wallet",
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [balances, setBalances] = useState<MultiBalance[]>([]);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) {
      setLoading(false);
      return;
    }
    Promise.allSettled([
      api.get<{ data: MultiBalance[] }>("/api/v1/my/balances").then((d) =>
        setBalances(d.data ?? []),
      ),
      api
        .get<ScansResponse>("/api/v1/my/scans?limit=100&offset=0")
        .then((d) => {
          setScans(d.data ?? []);
          setTotal(d.total ?? 0);
        }),
    ]).finally(() => setLoading(false));
  }, []);

  if (!loggedIn || loading || scans.length === 0) return null;

  const successCount = scans.filter((s) => s.scan_type === "success").length;
  const totalPoints = scans
    .filter((s) => s.scan_type === "success")
    .reduce((sum, s) => sum + s.points_earned, 0);
  const primaryBalance = getPrimaryBalance(balances);
  const secondaryBalances = getSecondaryBalances(balances);

  return (
    <div className="px-4 -mt-6 relative z-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 px-4 py-3 animate-slide-up">
        <div className="flex">
          {show_success_count && (
            <>
              <div className="flex-1 text-center animate-count-up px-1">
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight">
                  สแกนสำเร็จ
                </p>
                <p className="text-[20px] font-bold text-[var(--jh-green)] leading-tight mt-0.5">
                  {successCount.toLocaleString()}
                </p>
                <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-[var(--jh-green)]" />
              </div>
              <div className="w-px bg-gray-100 my-1" />
            </>
          )}

          {show_total_points && (
            <>
              <div
                className="flex-1 text-center animate-count-up px-1"
                style={{ animationDelay: "0.1s" }}
              >
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight">
                  แต้มสะสม
                </p>
                <p className="text-[20px] font-bold text-amber-500 leading-tight mt-0.5">
                  {totalPoints.toLocaleString()}
                </p>
                <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-amber-400" />
              </div>
              <div className="w-px bg-gray-100 my-1" />
            </>
          )}

          {show_balance && primaryBalance && (
            <>
              <Link
                href={balance_link}
                className="flex-1 text-center animate-count-up px-1 group"
                style={{ animationDelay: "0.15s" }}
              >
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight group-hover:text-[var(--jh-green)] transition-colors">
                  ยอดคงเหลือ
                </p>
                <p className="text-[20px] font-bold text-[var(--jh-green)] leading-tight mt-0.5">
                  {primaryBalance.balance.toLocaleString()}
                </p>
                <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-[var(--jh-green)]/40 group-hover:bg-[var(--jh-green)] transition-colors" />
              </Link>
              <div className="w-px bg-gray-100 my-1" />
            </>
          )}

          {show_total_scans && (
            <div
              className="flex-1 text-center animate-count-up px-1"
              style={{ animationDelay: "0.2s" }}
            >
              <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight">
                ทั้งหมด
              </p>
              <p className="text-[20px] font-bold text-blue-500 leading-tight mt-0.5">
                {total.toLocaleString()}
              </p>
              <div className="mx-auto mt-1.5 h-[3px] w-8 rounded-full bg-blue-400" />
            </div>
          )}
        </div>

        {secondaryBalances.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap gap-1.5 justify-center">
            {secondaryBalances.map((item) => (
              <Link
                key={item.currency}
                href={balance_link}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 hover:bg-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 transition-colors"
              >
                <span>{getCurrencyIcon(item.currency, item.icon)}</span>
                <span>
                  {item.balance.toLocaleString()} {item.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
