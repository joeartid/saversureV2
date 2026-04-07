"use client";

import { useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  show_next_tier_hint?: boolean;
}

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
}

interface Tier {
  id: string;
  name: string;
  icon: string;
  color: string;
  min_points: number;
}

interface TierResponse {
  tier: Tier | null;
}

export default function ProfileTierProgress({
  show_next_tier_hint = true,
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [points, setPoints] = useState<PointBalance | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [allTiers, setAllTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) {
      setLoading(false);
      return;
    }
    Promise.allSettled([
      api.get<PointBalance>("/api/v1/points/balance").then((d) => setPoints(d)),
      api.get<TierResponse>("/api/v1/my/tier").then((d) => setTier(d.tier)),
      api
        .get<{ data: Tier[] }>("/api/v1/public/tiers")
        .then((d) => setAllTiers(d.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  if (!loggedIn || loading || !points || allTiers.length === 0) return null;

  const sortedTiers = [...allTiers].sort((a, b) => a.min_points - b.min_points);
  let nextTier: Tier | null = null;
  if (tier) {
    const idx = sortedTiers.findIndex((t) => t.id === tier.id);
    if (idx >= 0 && idx < sortedTiers.length - 1) {
      nextTier = sortedTiers[idx + 1];
    }
  } else {
    nextTier = sortedTiers[0];
  }

  let progressPercent = 100;
  if (nextTier) {
    const currentMin = tier ? tier.min_points : 0;
    const nextMin = nextTier.min_points;
    const earned = points.total_earned;
    const rawPercent = ((earned - currentMin) / (nextMin - currentMin)) * 100;
    progressPercent = Math.min(Math.max(rawPercent, 0), 100);
  }

  return (
    <div className="px-4 mt-3">
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-2xl overflow-hidden">
        <CardContent className="p-5">
          {nextTier ? (
            <>
              <div className="flex justify-between items-end mb-1.5">
                <p className="text-[14px] font-bold text-gray-500">
                  ระดับปัจจุบัน:{" "}
                  <span className="text-gray-800">
                    {tier?.name || "MEMBER"}
                  </span>
                </p>
                <p className="text-[14px] font-bold text-gray-500">
                  {points.total_earned.toLocaleString()} /{" "}
                  {nextTier.min_points.toLocaleString()}
                  <span className="text-gray-400 ml-1">
                    &rarr; {nextTier.name}
                  </span>
                </p>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${progressPercent}%`,
                    background: tier?.color
                      ? `linear-gradient(90deg, ${tier.color}88 0%, ${tier.color} 100%)`
                      : "linear-gradient(90deg, #e5e7eb 0%, var(--jh-gold) 100%)",
                  }}
                />
              </div>
              {show_next_tier_hint && (
                <p className="text-[12px] text-gray-400 mt-1.5 text-right">
                  อีก{" "}
                  {(nextTier.min_points - points.total_earned).toLocaleString()}{" "}
                  แต้ม เพื่อเลื่อนระดับ
                </p>
              )}
            </>
          ) : (
            tier && (
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold text-[var(--jh-gold)] flex items-center gap-1">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  คุณอยู่ระดับสูงสุดแล้ว!
                </p>
                <p className="text-[14px] font-bold text-gray-500">
                  สะสมทั้งหมด: {points.total_earned.toLocaleString()}
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
