"use client";

import { useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  show_tier?: boolean;
  show_verified_badge?: boolean;
  show_completed_badge?: boolean;
  fallback_name?: string;
}

interface ProfileData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  profile_completed?: boolean;
  phone_verified?: boolean;
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

export default function ProfileHeaderCard({
  show_tier = true,
  show_verified_badge = true,
  show_completed_badge = true,
  fallback_name = "สมาชิก",
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) {
      setLoading(false);
      return;
    }
    Promise.allSettled([
      api.get<ProfileData>("/api/v1/profile").then((d) => setProfile(d)),
      show_tier
        ? api.get<TierResponse>("/api/v1/my/tier").then((d) => setTier(d.tier))
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [show_tier]);

  if (!loggedIn) return null;

  if (loading) {
    return (
      <div className="px-4 -mt-6 relative z-10">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-2xl overflow-hidden animate-pulse">
          <CardContent className="p-5 h-24" />
        </Card>
      </div>
    );
  }

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    fallback_name;

  return (
    <div className="px-4 -mt-6 relative z-10 animate-slide-up">
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-2xl overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-4 w-full">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary ring-[4px] ring-white shadow-[0_4px_15px_rgba(60,155,77,0.2)]"
                style={{
                  background:
                    "linear-gradient(135deg, var(--jh-green-light) 0%, var(--jh-lime) 100%)",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-8 h-8 text-white"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[22px] font-black text-gray-800 truncate tracking-tight">
                {displayName}
              </p>
              <p className="text-[16px] text-muted-foreground truncate font-medium">
                {profile?.email || profile?.phone || ""}
              </p>
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                {show_completed_badge && (
                  <Badge
                    variant={profile?.profile_completed ? "default" : "secondary"}
                    className={`text-[12px] px-2.5 py-0.5 rounded-full border-0 ${
                      profile?.profile_completed
                        ? "bg-green-50 text-[var(--jh-green)] font-bold"
                        : "bg-amber-50 text-amber-700 font-bold"
                    }`}
                  >
                    {profile?.profile_completed ? "ข้อมูลครบถ้วน" : "รอยืนยัน"}
                  </Badge>
                )}
                {show_verified_badge && profile?.phone_verified && (
                  <Badge
                    variant="default"
                    className="text-[12px] px-2.5 py-0.5 rounded-full border-0 bg-blue-50 text-blue-700 font-bold"
                  >
                    เบอร์ยืนยันแล้ว
                  </Badge>
                )}
              </div>
            </div>

            {/* Tier badge */}
            {show_tier && (
              <div className="shrink-0 flex flex-col items-end justify-center">
                {tier ? (
                  <div
                    className="text-white text-[14px] px-4 py-2 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] animate-bounce-in flex items-center gap-1.5 whitespace-nowrap border border-white/40 backdrop-blur-md"
                    style={{
                      background: tier.color
                        ? `linear-gradient(135deg, ${tier.color}f2 0%, ${tier.color} 100%)`
                        : "linear-gradient(135deg, var(--jh-gold) 0%, #B8860B 100%)",
                    }}
                  >
                    <span className="text-[16px] leading-none drop-shadow-sm">
                      {tier.icon}
                    </span>
                    <span className="text-[16px] leading-none font-black tracking-tight drop-shadow-sm">
                      {tier.name}
                    </span>
                  </div>
                ) : (
                  <div className="bg-[linear-gradient(135deg,var(--jh-gold)_0%,#B8860B_100%)] text-white text-[14px] font-black px-4 py-2 rounded-xl shadow-sm animate-bounce-in border border-white/40">
                    MEMBER
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
