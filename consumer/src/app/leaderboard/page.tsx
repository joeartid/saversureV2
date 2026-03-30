"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { api } from "@/lib/api";
import { isLoggedIn, getUser } from "@/lib/auth";

type PeriodType = "weekly" | "monthly" | "all-time";

interface LeaderboardEntry {
  rank: number;
  user_id?: string;
  user_name?: string;
  display_name?: string;
  score: number;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<PeriodType>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loggedIn = isLoggedIn();
  const user = getUser();
  const currentUserId = user?.user_id;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const now = new Date();
        let periodKey = "";
        if (period === "weekly") periodKey = getWeekKey(now);
        if (period === "monthly") periodKey = getMonthKey(now);

        const params = new URLSearchParams({
          period: period === "all-time" ? "all_time" : period,
          category: "scan",
          limit: "20",
        });
        if (periodKey) params.set("period_key", periodKey);

        const res = await api.get<{ data?: LeaderboardEntry[] } | LeaderboardEntry[]>(
          `/api/v1/public/leaderboard?${params}`
        );
        const list = Array.isArray(res) ? res : res.data ?? [];
        setEntries(list);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  const displayName = (e: LeaderboardEntry) =>
    e.display_name || e.user_name || (e.user_id ? `User ${e.user_id.slice(0, 8)}` : `อันดับ ${e.rank}`);

  return (
    <div className="pb-20">
      <Navbar />
      <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] text-white px-5 pt-12 pb-6 rounded-b-[24px]">
        <h1 className="text-[22px] font-semibold">อันดับ</h1>
        <p className="text-[13px] opacity-80 mt-1">ดูอันดับการสแกน</p>
      </div>

      <div className="px-5 mt-6">
        {/* Period tabs */}
        <div className="flex bg-[var(--surface-container)] rounded-[var(--radius-xl)] p-1 mb-6">
          {(["weekly", "monthly", "all-time"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 h-[36px] rounded-[var(--radius-xl)] text-[13px] font-medium transition-all ${
                period === p ? "bg-white elevation-1 text-[var(--primary)]" : "text-[var(--on-surface-variant)]"
              }`}
            >
              {p === "weekly" ? "รายสัปดาห์" : p === "monthly" ? "รายเดือน" : "ตลอดกาล"}
            </button>
          ))}
        </div>

        {!loggedIn && (
          <div className="mb-4 bg-white rounded-[var(--radius-lg)] elevation-1 p-4 text-center">
            <p className="text-[14px] text-[var(--on-surface-variant)] mb-3">เข้าสู่ระบบเพื่อดูอันดับของคุณ</p>
            <Link
              href="/login"
              className="inline-block h-[44px] px-8 leading-[44px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[14px] font-medium"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <svg className="animate-spin w-8 h-8 mx-auto text-[var(--primary)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="bg-[var(--error-light)] border border-[var(--error)] rounded-[var(--radius-lg)] p-4 text-center">
            <p className="text-[14px] font-medium text-[var(--error)]">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-[var(--on-surface-variant)]">
            <p className="text-[14px]">ยังไม่มีข้อมูลอันดับ</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Top 3 podium */}
            {entries.length >= 3 && (
              <div className="flex justify-center items-end gap-2 mb-6 pb-4">
                {/* 2nd */}
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-[var(--on-surface)] font-bold text-lg mb-2">
                    2
                  </div>
                  <p className="text-[12px] font-medium text-[var(--on-surface)] text-center line-clamp-1">
                    {displayName(entries[1])}
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)]">{entries[1].score.toLocaleString()} pts</p>
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center w-1/3 -mt-4">
                  <div className="w-14 h-14 rounded-full bg-amber-400 flex items-center justify-center text-[var(--on-surface)] font-bold text-xl mb-2">
                    1
                  </div>
                  <p className="text-[13px] font-medium text-[var(--on-surface)] text-center line-clamp-1">
                    {displayName(entries[0])}
                  </p>
                  <p className="text-[12px] text-[var(--on-surface-variant)]">{entries[0].score.toLocaleString()} pts</p>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-12 h-12 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-lg mb-2">
                    3
                  </div>
                  <p className="text-[12px] font-medium text-[var(--on-surface)] text-center line-clamp-1">
                    {displayName(entries[2])}
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)]">{entries[2].score.toLocaleString()} pts</p>
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="bg-white rounded-[var(--radius-lg)] elevation-1 overflow-hidden">
              {entries.map((e, idx) => {
                const isCurrentUser = currentUserId && e.user_id === currentUserId;
                const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : null;

                return (
                  <div
                    key={e.rank}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--outline-variant)] last:border-0 ${
                      isCurrentUser ? "bg-[var(--primary-light)]" : ""
                    }`}
                  >
                    <span className="w-8 text-[14px] font-semibold text-[var(--on-surface-variant)]">
                      {medal ?? e.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-medium truncate ${isCurrentUser ? "text-[var(--primary)]" : "text-[var(--on-surface)]"}`}>
                        {displayName(e)}
                        {isCurrentUser && " (คุณ)"}
                      </p>
                    </div>
                    <span className="text-[14px] font-semibold text-[var(--on-surface)]">
                      {e.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
