"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { isLoggedIn, getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTenant } from "@/components/TenantProvider";

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
}

export default function HomePage() {
  const { branding } = useTenant();
  const [loggedIn, setLoggedIn] = useState(false);
  const [points, setPoints] = useState<number>(0);
  const [user, setUser] = useState<{ user_id: string } | null>(null);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    setUser(getUser());
    if (li) {
      api.get<PointBalance>("/api/v1/points/balance")
        .then((d) => setPoints(d.current ?? 0))
        .catch(() => {});
    }
  }, []);

  return (
    <div className="pb-20">
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-[var(--primary)] to-[#1557b0] text-white px-5 pt-12 pb-8 rounded-b-[24px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[13px] opacity-80">Welcome back</p>
            <h1 className="text-[22px] font-semibold mt-0.5">
              {loggedIn ? `User ${user?.user_id?.slice(0, 6)}` : "Guest"}
            </h1>
          </div>
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={branding.brand_name || ""} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Points card */}
        <div className="bg-white/15 backdrop-blur rounded-[var(--radius-lg)] p-5">
          <p className="text-[12px] opacity-80 mb-1">Total Points</p>
          <p className="text-[36px] font-bold leading-none">{(points ?? 0).toLocaleString()}</p>
          <p className="text-[12px] opacity-70 mt-2">pts</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-5 mt-6">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/scan"
            className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--primary-light)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="var(--primary)" className="w-6 h-6">
                <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-[var(--on-surface)]">Scan QR</span>
          </Link>
          <Link
            href="/rewards"
            className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--success-light)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="var(--success)" className="w-6 h-6">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-[var(--on-surface)]">Redeem</span>
          </Link>
          <Link
            href="/history"
            className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--info-light)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="var(--info)" className="w-6 h-6">
                <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-[var(--on-surface)]">History</span>
          </Link>
          <Link
            href="/profile"
            className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--warning-light)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="var(--warning)" className="w-6 h-6">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-[var(--on-surface)]">Profile</span>
          </Link>
          <Link
            href="/missions"
            className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--info-light)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="var(--info)" className="w-6 h-6">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-[var(--on-surface)]">ภารกิจ</span>
          </Link>
          <Link
            href="/badges"
            className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="#d97706" className="w-6 h-6">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-[var(--on-surface)]">Badge</span>
          </Link>
          <Link
            href="/leaderboard"
            className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="#7c3aed" className="w-6 h-6">
                <path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-[var(--on-surface)]">อันดับ</span>
          </Link>
        </div>
      </div>

      {!loggedIn && (
        <div className="px-5 mt-6">
          <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-5 text-center">
            <p className="text-[14px] text-[var(--on-surface-variant)] mb-3">
              Login to start collecting points
            </p>
            <Link
              href="/login"
              className="inline-block h-[44px] px-8 leading-[44px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[14px] font-medium"
            >
              Login / Register
            </Link>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
