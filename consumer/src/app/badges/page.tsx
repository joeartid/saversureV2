"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

type BadgeRarity = "common" | "rare" | "epic" | "legendary";

interface Badge {
  id: string;
  name: string;
  description?: string;
  image_url?: string | null;
  rarity?: BadgeRarity;
}

interface EarnedBadge {
  badge_id: string;
  earned_at?: string;
}

const RARITY_STYLES: Record<string, string> = {
  common: "border-2 border-gray-400",
  rare: "border-2 border-blue-500",
  epic: "border-2 border-purple-500",
  legendary: "border-2 border-amber-500",
};

function formatDate(s: string | undefined): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedMap, setEarnedMap] = useState<Record<string, EarnedBadge>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loggedIn = isLoggedIn();

  useEffect(() => {
    const load = async () => {
      try {
        const [badgesRes, earnedRes] = await Promise.all([
          api.get<{ data?: Badge[] } | Badge[]>("/api/v1/public/badges"),
          loggedIn ? api.get<{ data?: EarnedBadge[] } | EarnedBadge[]>("/api/v1/my/badges").catch(() => null) : null,
        ]);

        const badgesList = Array.isArray(badgesRes) ? badgesRes : badgesRes.data ?? [];
        setBadges(badgesList);

        if (earnedRes) {
          const list = Array.isArray(earnedRes) ? earnedRes : earnedRes.data ?? [];
          const map: Record<string, EarnedBadge> = {};
          list.forEach((e) => {
            map[e.badge_id] = e;
          });
          setEarnedMap(map);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loggedIn]);

  return (
    <div className="pb-20">
      <Navbar />
      <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] text-white px-5 pt-12 pb-6 rounded-b-[24px]">
        <h1 className="text-[22px] font-semibold">Badge</h1>
        <p className="text-[13px] opacity-80 mt-1">สะสม Badge จากภารกิจและกิจกรรม</p>
      </div>

      {!loggedIn && (
        <div className="px-5 mt-4">
          <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 text-center">
            <p className="text-[14px] text-[var(--on-surface-variant)] mb-3">เข้าสู่ระบบเพื่อดู Badge ที่ได้รับ</p>
            <Link
              href="/login"
              className="inline-block h-[44px] px-8 leading-[44px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[14px] font-medium"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      )}

      <div className="px-5 mt-6">
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
        ) : badges.length === 0 ? (
          <div className="text-center py-12 text-[var(--on-surface-variant)]">
            <p className="text-[14px]">ยังไม่มี Badge</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {badges.map((b) => {
              const earned = earnedMap[b.id];
              const isEarned = !!earned;
              const rarity = (b.rarity ?? "common") as BadgeRarity;
              const borderClass = RARITY_STYLES[rarity] ?? RARITY_STYLES.common;

              return (
                <div
                  key={b.id}
                  className={`bg-white rounded-[var(--radius-lg)] elevation-1 p-3 text-center ${borderClass}`}
                >
                  <div
                    className={`relative aspect-square rounded-[var(--radius-md)] overflow-hidden mx-auto ${
                      isEarned ? "" : "grayscale opacity-60"
                    }`}
                  >
                    {b.image_url ? (
                      <img src={b.image_url} alt={b.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[var(--surface-container)] flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-[var(--on-surface-variant)]">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                    )}
                    {!isEarned && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8 opacity-80">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="text-[13px] font-medium text-[var(--on-surface)] mt-2 line-clamp-2">{b.name}</h3>
                  {isEarned ? (
                    <p className="text-[11px] text-[var(--success)] font-medium mt-1">ได้รับแล้ว</p>
                  ) : (
                    <p className="text-[11px] text-[var(--on-surface-variant)] mt-1">ยังไม่ได้รับ</p>
                  )}
                  {isEarned && earned.earned_at && (
                    <p className="text-[10px] text-[var(--on-surface-variant)] mt-0.5">{formatDate(earned.earned_at)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
