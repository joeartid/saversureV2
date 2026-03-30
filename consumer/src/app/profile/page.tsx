"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import RedeemCard, { type RedeemEntry } from "@/components/RedeemCard";
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

export default function ProfilePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [points, setPoints] = useState<PointBalance>({ current: 0, total_earned: 0, total_spent: 0 });
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [recentRedeems, setRecentRedeems] = useState<RedeemEntry[]>([]);

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
      api.get<{ data: RedeemEntry[] }>("/api/v1/my/redeem-transactions?limit=5")
        .then((d) => setRecentRedeems(d.data || []))
        .catch(() => {});
    }
  }, []);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "สมาชิก";

  const quickLinks = [
    {
      href: "/history",
      label: "ประวัติสะสมแต้ม",
      color: "var(--jh-green)",
      bgColor: "bg-green-50",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      href: "/history/redeems",
      label: "ประวัติการแลกแต้ม",
      color: "var(--jh-purple)",
      bgColor: "bg-purple-50",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12" /></svg>,
    },
    {
      href: "/activity",
      label: "กิจกรรมของฉัน",
      color: "var(--jh-teal)",
      bgColor: "bg-teal-50",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.75 3.75 0 0012.75 10.5h-.75m-3 8.25V14.25m0 0a3 3 0 01-3-3V8.25m3 3h6m-9 0V5.625A2.625 2.625 0 019.375 3h5.25A2.625 2.625 0 0117.25 5.625V8.25" /></svg>,
    },
    {
      href: "/scan",
      label: "สแกนสะสมแต้ม",
      color: "var(--jh-orange)",
      bgColor: "bg-orange-50",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" /></svg>,
    },
  ];

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />

      <div className="pt-24">
        <PageHeader title="โปรไฟล์" subtitle="จัดการข้อมูลสมาชิกของคุณ" />

        {loggedIn ? (
          <>
            {/* Profile Card */}
            <div className="px-4 -mt-8 relative z-10 animate-slide-up">
              <Card className="border-0 shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    {/* Avatar with gradient ring */}
                    <div className="relative">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary ring-[3px] ring-[var(--jh-green)] ring-offset-2"
                        style={{ background: "linear-gradient(135deg, var(--jh-green-light) 0%, var(--jh-lime) 100%)" }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                      {/* Tier badge */}
                      <div className="absolute -bottom-1 -right-1 bg-[var(--jh-gold)] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-bounce-in">
                        LV1
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {profile?.email || profile?.phone || ""}
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        <Badge variant={profile?.profile_completed ? "default" : "secondary"} className={`text-[10px] px-2 py-0 ${profile?.profile_completed ? "bg-green-50 text-[var(--jh-green)]" : "bg-amber-50 text-amber-700"}`}>
                          {profile?.profile_completed ? "ข้อมูลครบถ้วน" : "รอยืนยัน"}
                        </Badge>
                        {profile?.phone_verified && (
                          <Badge variant="default" className="text-[10px] px-2 py-0 bg-blue-50 text-blue-700">
                            เบอร์ยืนยันแล้ว
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Circular Points & Tier Badges */}
            <div className="px-4 mt-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-center gap-8">
                    {/* Points circle */}
                    <div className="flex flex-col items-center animate-scale-in">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-full shadow-md"
                        style={{ background: "linear-gradient(135deg, var(--jh-green) 0%, var(--jh-green-dark) 100%)" }}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </div>
                      <p className="text-xl font-bold text-[var(--jh-green)] mt-2">
                        {points.current.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-muted-foreground">แต้มสะสม</p>
                    </div>

                    {/* Divider */}
                    <div className="h-16 w-px bg-border" />

                    {/* Tier circle */}
                    <div className="flex flex-col items-center animate-scale-in" style={{ animationDelay: "0.1s" }}>
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-full shadow-md"
                        style={{ background: "linear-gradient(135deg, var(--jh-purple) 0%, #5a3d99 100%)" }}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      </div>
                      <p className="text-xl font-bold text-[var(--jh-purple)] mt-2">
                        {points.total_earned.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-muted-foreground">เทียร์</p>
                    </div>
                  </div>

                  {/* Sub-stats row */}
                  <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-border">
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground">สะสมทั้งหมด</p>
                      <p className="text-sm font-bold text-blue-500">{points.total_earned.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground">ใช้ไปแล้ว</p>
                      <p className="text-sm font-bold text-[var(--jh-orange)]">{points.total_spent.toLocaleString()}</p>
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
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 animate-wiggle">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-600"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-900">กรอกข้อมูลให้ครบถ้วน</p>
                        <p className="text-xs text-amber-700/80 mt-0.5">ยืนยันเบอร์โทรเพื่อรับสิทธิประโยชน์เต็มรูปแบบ</p>
                      </div>
                      <Link href="/register/complete" className="rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white">
                        ยืนยัน
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick links with colorful left border */}
            <div className="px-4 mt-4">
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {quickLinks.map((item, i) => (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3.5 px-4 py-3.5 transition-all hover:bg-muted hover:translate-x-1 relative"
                        style={{ borderLeft: `3px solid ${item.color}` }}
                      >
                        <span className={`${item.bgColor} p-1.5 rounded-lg`} style={{ color: item.color }}>{item.icon}</span>
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-muted-foreground"><path d="M9 18l6-6-6-6" /></svg>
                      </Link>
                      {i < quickLinks.length - 1 && <Separator />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Recent Redemption History Preview */}
            {recentRedeems.length > 0 && (
              <div className="px-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold">ประวัติการแลกรางวัล</h3>
                  <Link href="/history/redeems" className="text-[12px] font-semibold text-[var(--jh-green)]">
                    ดูทั้งหมด →
                  </Link>
                </div>
                <div className="space-y-2 stagger-children">
                  {recentRedeems.map((entry) => (
                    <RedeemCard key={entry.id} entry={entry} compact />
                  ))}
                </div>
              </div>
            )}

            {/* Logout - ghost style, more subtle */}
            <div className="px-4 mt-6 mb-4">
              <button
                onClick={() => logout()}
                className="w-full rounded-xl py-3 text-sm font-medium text-gray-400 transition hover:text-red-400 hover:bg-red-50/50"
              >
                ออกจากระบบ
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 -mt-8 relative z-10 animate-slide-up">
            <Card className="border-0 shadow-md">
              <CardContent className="flex flex-col items-center py-16 px-6">
                <div className="w-20 h-20 mb-4 rounded-full bg-secondary flex items-center justify-center animate-float">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-[var(--jh-green)]">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold">กรุณาเข้าสู่ระบบ</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-6 text-center">เข้าสู่ระบบเพื่อดูข้อมูลบัญชีและสิทธิพิเศษของคุณ</p>
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
