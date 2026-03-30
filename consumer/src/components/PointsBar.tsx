"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useTenant } from "@/components/TenantProvider";
import {
  type MultiBalance,
  getPrimaryBalance,
  getSecondaryBalances,
} from "@/lib/currency";

interface UserProfile {
  display_name?: string;
  first_name?: string;
  last_name?: string;
}

export default function PointsBar() {
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const { brandName } = useTenant();

  useEffect(() => {
    const isLog = isLoggedIn();
    setLoggedIn(isLog);
    if (isLog) {
      api.get<{ data: MultiBalance[] }>("/api/v1/my/balances")
        .then((d) => setBalances(d.data ?? [])).catch(() => {});
      api.get<UserProfile>("/api/v1/profile")
        .then((d) => setProfile(d)).catch(() => {});
    }
  }, []);

  const primaryBal = getPrimaryBalance(balances);
  const secondaryBals = getSecondaryBalances(balances);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    brandName;

  return (
    <div className="app-fixed-bar fixed top-14 z-[990] bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] text-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-[6px] text-[15px] font-bold">
        <span>
          {loggedIn ? `${displayName} Points` : `${brandName} Points`}
        </span>
        <div className="flex items-center gap-1.5">
          <span>แต้ม {(primaryBal?.balance ?? 0).toLocaleString()}</span>
          <span className="text-[12px]">🪙</span>
          <span className="opacity-40 mx-0.5">|</span>
          <span>เพชร {secondaryBals.length > 0 ? secondaryBals[0].balance.toLocaleString() : "0"}</span>
          <span className="text-[12px]">💎</span>
        </div>
      </div>
    </div>
  );
}
