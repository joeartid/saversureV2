"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { isLoggedIn, logout } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
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

const ICONS = {
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  history: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  gift: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  help: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  headphone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  docs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground"><path d="M9 18l6-6-6-6" /></svg>
};

const MENU_GROUPS = [
  {
    title: "บัญชีและการทำรายการ",
    items: [
      { href: "/profile/edit", label: "ข้อมูลส่วนตัว และ ที่อยู่", icon: ICONS.user, color: "text-blue-500", bg: "bg-blue-50" },
      { href: "/history", label: "ประวัติแต้มและกิจกรรม", icon: ICONS.history, color: "text-[var(--jh-green)]", bg: "bg-green-50" },
      { href: "/rewards/my-coupons", label: "คูปองและของรางวัลของฉัน", icon: ICONS.gift, color: "text-orange-500", bg: "bg-orange-50" },
    ]
  },
  {
    title: "การช่วยเหลือและสนับสนุน",
    items: [
      { href: "/support", label: "ศูนย์ช่วยเหลือ / คำถามที่พบบ่อย", icon: ICONS.help, color: "text-teal-500", bg: "bg-teal-50" },
      { href: "/support/history", label: "แจ้งปัญหา", icon: ICONS.list, color: "text-slate-600", bg: "bg-slate-100" },
    ]
  },
  {
    title: "ระบบ",
    items: [
      { href: "/settings", label: "การตั้งค่าแอปพลิเคชัน", icon: ICONS.settings, color: "text-gray-600", bg: "bg-gray-100" },
      { href: "/terms", label: "ข้อกำหนดและนโยบาย", icon: ICONS.docs, color: "text-gray-600", bg: "bg-gray-100" },
    ]
  }
];

export default function ProfilePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [points, setPoints] = useState<PointBalance>({ current: 0, total_earned: 0, total_spent: 0 });
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [allTiers, setAllTiers] = useState<Tier[]>([]);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (li) {
      api.get<PointBalance>("/api/v1/points/balance")
        .then((d) => setPoints(d))
        .catch(() => {});
      api.get<ProfileData>("/api/v1/profile")
        .then((d) => setProfile(d))
        .catch(() => {});
      api.get<TierResponse>("/api/v1/my/tier")
        .then((d) => setTier(d.tier))
        .catch(() => {});
      api.get<{data: Tier[]}>("/api/v1/public/tiers")
        .then((d) => setAllTiers(d.data || []))
        .catch(() => {});
    }
  }, []);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "สมาชิก";

  let currentTier = tier;
  let nextTier: Tier | null = null;
  let progressPercent = 100;

  if (allTiers.length > 0) {
    const sortedTiers = [...allTiers].sort((a, b) => a.min_points - b.min_points);
    if (currentTier) {
      const idx = sortedTiers.findIndex(t => t.id === currentTier!.id);
      if (idx >= 0 && idx < sortedTiers.length - 1) {
        nextTier = sortedTiers[idx + 1];
      }
    } else {
      nextTier = sortedTiers[0];
    }

    if (nextTier) {
      const currentMin = currentTier ? currentTier.min_points : 0;
      const nextMin = nextTier.min_points;
      const earned = points.total_earned;
      const rawPercent = ((earned - currentMin) / (nextMin - currentMin)) * 100;
      progressPercent = Math.min(Math.max(rawPercent, 0), 100);
    }
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />

      <div className="pt-24">
        <PageHeader title="โปรไฟล์" subtitle="จัดการข้อมูลบัญชีผู้ใช้และกิจกรรมต่างๆ" />

        {loggedIn ? (
          <>
            {/* Profile Header Block */}
            <div className="px-4 -mt-6 relative z-10 animate-slide-up">
              <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-2xl overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex items-center gap-4 w-full">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary ring-[4px] ring-white shadow-[0_4px_15px_rgba(60,155,77,0.2)]"
                        style={{ background: "linear-gradient(135deg, var(--jh-green-light) 0%, var(--jh-lime) 100%)" }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[19px] font-black text-gray-800 truncate tracking-tight">{displayName}</p>
                      <p className="text-[13px] text-muted-foreground truncate font-medium">
                        {profile?.email || profile?.phone || ""}
                      </p>
                      <div className="mt-1.5 flex gap-1.5 flex-wrap">
                        <Badge variant={profile?.profile_completed ? "default" : "secondary"} className={`text-[10px] px-2.5 py-0.5 rounded-full border-0 ${profile?.profile_completed ? "bg-green-50 text-[var(--jh-green)] font-bold" : "bg-amber-50 text-amber-700 font-bold"}`}>
                          {profile?.profile_completed ? "ข้อมูลครบถ้วน" : "รอยืนยัน"}
                        </Badge>
                        {profile?.phone_verified && (
                          <Badge variant="default" className="text-[10px] px-2.5 py-0.5 rounded-full border-0 bg-blue-50 text-blue-700 font-bold">
                            เบอร์ยืนยันแล้ว
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Tier badge on the right */}
                    <div className="shrink-0 flex flex-col items-end justify-center">
                      {tier ? (
                        <div 
                          className="text-white text-[13px] px-4 py-2 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] animate-bounce-in flex items-center gap-1.5 whitespace-nowrap border border-white/40 backdrop-blur-md"
                          style={{ 
                            background: tier.color 
                              ? `linear-gradient(135deg, ${tier.color}f2 0%, ${tier.color} 100%)` 
                              : "linear-gradient(135deg, var(--jh-gold) 0%, #B8860B 100%)" 
                          }}
                        >
                          <span className="text-[17px] leading-none drop-shadow-sm">{tier.icon}</span>
                          <span className="leading-none font-black tracking-tight drop-shadow-sm">{tier.name}</span>
                        </div>
                      ) : (
                        <div className="bg-[linear-gradient(135deg,var(--jh-gold)_0%,#B8860B_100%)] text-white text-[12px] font-black px-4 py-2 rounded-xl shadow-sm animate-bounce-in border border-white/40">
                          MEMBER
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tier Progress Bar */}
                  {allTiers.length > 0 && nextTier && (
                    <div className="mt-5 pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-end mb-1.5">
                        <p className="text-[11px] font-bold text-gray-500">
                          ระดับปัจจุบัน: <span className="text-gray-800">{currentTier?.name || "MEMBER"}</span>
                        </p>
                        <p className="text-[11px] font-bold text-gray-500">
                          {points.total_earned.toLocaleString()} / {nextTier.min_points.toLocaleString()} 
                          <span className="text-gray-400 ml-1">&rarr; {nextTier.name}</span>
                        </p>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ 
                            width: `${progressPercent}%`,
                            background: currentTier?.color 
                              ? `linear-gradient(90deg, ${currentTier.color}88 0%, ${currentTier.color} 100%)` 
                              : "linear-gradient(90deg, #e5e7eb 0%, var(--jh-gold) 100%)" 
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5 text-right">
                        อีก {(nextTier.min_points - points.total_earned).toLocaleString()} แต้ม เพื่อเลื่อนระดับ
                      </p>
                    </div>
                  )}
                  {allTiers.length > 0 && !nextTier && currentTier && (
                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-[12px] font-bold text-[var(--jh-gold)] flex items-center gap-1">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        คุณอยู่ระดับสูงสุดแล้ว!
                      </p>
                      <p className="text-[11px] font-bold text-gray-500">
                         สะสมทั้งหมด: {points.total_earned.toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* White Sleek Wallet Points Summary */}
            <div className="px-4 mt-4">
              <Card className="border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden rounded-2xl bg-white relative">
                {/* Subtle top accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(90deg,var(--jh-green)_0%,var(--jh-lime)_100%)]" />
                
                <CardContent className="p-5 relative z-10 pt-6">
                  <div className="flex items-end justify-between pb-5 border-b border-gray-100/80">
                     <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1 text-gray-400">
                           <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--jh-gold)] drop-shadow-sm"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.24-.97-2.31-1.8h-1.7c.07 1.69 1.11 2.76 2.81 3.14V19h2.38v-1.67c1.6-.32 2.78-1.25 2.78-2.91.01-1.89-1.48-2.7-3.66-3.21z" /></svg>
                           <h3 className="text-[12px] font-bold tracking-wide">แต้มสะสมใช้งานได้</h3>
                        </div>
                        <p className="text-[36px] leading-[1] font-black text-[var(--jh-green)] tracking-tighter drop-shadow-sm">
                          {points.current.toLocaleString()}
                        </p>
                     </div>
                     <Link href="/history" className="bg-gray-900 hover:bg-black text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-sm active:scale-95 transition-all flex items-center gap-1.5 mb-1 group">
                        ใช้แต้ม
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                     </Link>
                  </div>
                  <div className="flex justify-between pt-4 px-1 border-t-0">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] font-bold text-gray-400 tracking-wider">ใช้ไปแล้ว</p>
                      <p className="text-[15px] font-bold text-gray-700">{points.total_spent.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 items-end">
                      <p className="text-[11px] font-bold text-gray-400 tracking-wider">สะสมทั้งหมด</p>
                      <p className="text-[15px] font-black text-gray-700">{points.total_earned.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Incomplete profile warning */}
            {!profile?.profile_completed && (
              <div className="px-4 mt-3 animate-slide-up">
                <Card className="border-amber-200 bg-amber-50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-600"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-900">กรอกข้อมูลให้ครบถ้วน</p>
                        <p className="text-[11px] text-amber-700/80 mt-0.5 leading-tight">ยืนยันรหัส OTP และข้อมูลเพื่อรับสิทธิประโยชน์</p>
                      </div>
                      <Link href="/register/complete" className="rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white whitespace-nowrap">
                        รีบทำเลย
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Render Menu Groups */}
            <div className="px-4 mt-4 space-y-4">
              {MENU_GROUPS.map((group, groupIdx) => (
                <div key={groupIdx} className="animate-slide-up" style={{ animationDelay: `${groupIdx * 50}ms` }}>
                  <h3 className="text-[12px] font-bold text-muted-foreground tracking-wide ml-2 mb-2">
                    {group.title}
                  </h3>
                  <Card className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden rounded-2xl">
                    <CardContent className="p-0">
                      {group.items.map((item, i) => (
                        <div key={item.label}>
                          <Link
                            href={item.href}
                            className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/50 active:bg-muted"
                          >
                            <span className={`${item.bg} p-2 rounded-xl border border-black/5`}>
                              <div className={`${item.color}`}>
                                {item.icon}
                              </div>
                            </span>
                            <span className="flex-1 text-[14px] font-semibold text-gray-800">{item.label}</span>
                            {ICONS.chevron}
                          </Link>
                          {i < group.items.length - 1 && <Separator className="ml-[60px]" />}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>

            {/* Logout Button */}
            <div className="px-4 py-8">
              <button
                onClick={() => logout()}
                className="w-full flex justify-center items-center gap-2 rounded-2xl py-3.5 bg-red-50 text-[14px] font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                ออกจากระบบ
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 -mt-6 relative z-10 animate-slide-up">
            <Card className="border-0 shadow-md rounded-2xl">
              <CardContent className="flex flex-col items-center py-16 px-6">
                <div className="w-20 h-20 mb-4 rounded-full bg-secondary flex items-center justify-center animate-float">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-[var(--jh-green)]">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold">กรุณาเข้าสู่ระบบ</h3>
                <p className="text-[13px] text-muted-foreground mt-1 mb-6 text-center">ต้องเข้าสู่ระบบเพื่อเข้าดูข้อมูล Profile Hub และการสนับสนุนแบบส่วนตัวของคุณ</p>
                <Link href="/login" className="rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] px-8 py-2.5 text-sm font-bold text-white shadow-md shadow-green-200/50">
                  เข้าสู่ระบบ
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
