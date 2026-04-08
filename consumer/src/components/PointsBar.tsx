"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useTenant } from "@/components/TenantProvider";
import { useCurrencies } from "@/lib/currency-context";
import CurrencySheet from "@/components/CurrencySheet";

interface UserProfile {
  display_name?: string;
  first_name?: string;
  last_name?: string;
}

export default function PointsBar() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { brandName } = useTenant();
  const { primary, balances } = useCurrencies();

  useEffect(() => {
    const isLog = isLoggedIn();
    setLoggedIn(isLog);
    if (isLog) {
      api
        .get<UserProfile>("/api/v1/profile")
        .then((d) => setProfile(d))
        .catch(() => {});
    }
  }, []);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    brandName;

  // nothing to display: tenant has no currencies configured
  if (balances.length === 0) return null;

  const balanceText = loggedIn
    ? (primary?.balance ?? 0).toLocaleString()
    : "—";

  return (
    <>
      <div className="app-fixed-bar fixed top-14 z-[990] bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] text-white shadow-sm">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center justify-between px-4 py-2 text-[17px] font-bold active:opacity-80 transition-opacity"
          aria-label="ดูกระเป๋าแต้มทั้งหมด"
        >
          <span className="truncate text-left">
            {loggedIn ? `${displayName} Points` : `${brandName} Points`}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[15px]">{primary?.icon ?? "⭐"}</span>
            <span>{balanceText}</span>
            <span className="opacity-80 text-[12px]">▾</span>
          </div>
        </button>
      </div>

      <CurrencySheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
