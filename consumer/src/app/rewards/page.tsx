"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RewardItem {
  id: string;
  name: string;
  description: string;
  type: string;
  point_cost: number;
  cost_currency: string;
  image_url?: string;
  delivery_type: string;
  available_qty: number;
  is_flash: boolean;
  flash_start?: string;
  flash_end?: string;
  tier_id?: string;
  tier_name?: string;
}

interface CurrencyMaster {
  code: string;
  name: string;
  icon: string;
  active: boolean;
}

const currencyFallback: Record<string, string> = {
  point: "🪙",
  diamond: "💎",
};

const deliveryLabel: Record<string, string> = {
  shipping: "จัดส่งถึงบ้าน",
  coupon: "คูปองออนไลน์",
  pickup: "รับหน้าร้าน",
  digital: "ดิจิทัล",
  ticket: "ตั๋ว/บัตรเข้างาน",
  none: "",
};

const mediaUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userBalance, setUserBalance] = useState<Record<string, number>>({});
  const [currencyMap, setCurrencyMap] = useState<Record<string, CurrencyMaster>>({});
  const [activeTab, setActiveTab] = useState<"julaherb" | "premium" | "lifestyle">("julaherb");

  const filteredRewards = rewards.filter((r) => {
    if (activeTab === "julaherb") return r.type === "product";
    if (activeTab === "premium") return r.type === "premium";
    if (activeTab === "lifestyle") return ["coupon", "digital", "ticket"].includes(r.delivery_type) || ["coupon", "digital", "ticket"].includes(r.type);
    return true;
  });

  const getIcon = (code: string) => {
    const c = currencyMap[code.toLowerCase()];
    return c?.icon || currencyFallback[code.toLowerCase()] || "⭐";
  };

  const getName = (code: string) => {
    const c = currencyMap[code.toLowerCase()];
    return c?.name || code;
  };

  useEffect(() => {
    api
      .get<{ data: RewardItem[]; total: number }>("/api/v1/public/rewards?limit=50")
      .then((d) => setRewards(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    api
      .get<{ data: CurrencyMaster[] }>("/api/v1/public/currencies")
      .then((d) => {
        const map: Record<string, CurrencyMaster> = {};
        (d.data || []).forEach((c) => (map[c.code.toLowerCase()] = c));
        setCurrencyMap(map);
      })
      .catch(() => {});

    if (isLoggedIn()) {
      api
        .get<{ data: { currency: string; balance: number }[] }>("/api/v1/my/balances")
        .then((d) => {
          const map: Record<string, number> = {};
          (d.data || []).forEach((b) => (map[b.currency.toLowerCase()] = b.balance));
          setUserBalance(map);
        })
        .catch(() => {});
    }
  }, []);

  const canAfford = (cost: number, currency: string) => {
    return (userBalance[currency.toLowerCase()] ?? 0) >= cost;
  };

  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        {/* Header with animated gradient */}
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-10 text-white relative overflow-hidden">
          {/* Floating decorative shapes */}
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 animate-float" />
          <div className="absolute right-16 top-12 h-8 w-8 rounded-full bg-white/10 animate-float-delay-1" />
          <div className="absolute left-8 -bottom-4 h-16 w-16 rounded-full bg-white/5 animate-float-delay-2" />

          <h1 className="text-3xl font-black tracking-tight leading-[1] mb-0 drop-shadow-md relative animate-slide-up">🎁 แลกรางวัล</h1>
          <p className="text-sm font-medium text-white/95 -mt-1.5 relative animate-slide-up" style={{ animationDelay: "60ms" }}>แลกของรางวัลและสิทธิพิเศษ</p>

          {isLoggedIn() && Object.keys(userBalance).length > 0 && (
            <div className="flex items-center gap-3 mt-4 relative flex-wrap stagger-children">
              {Object.entries(userBalance).map(([currency, balance]) => (
                <div
                  key={currency}
                  className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-bold relative group cursor-default transition-all hover:bg-white/30 hover:scale-105"
                >
                  <span>{getIcon(currency)}</span>{" "}
                  {balance.toLocaleString()} {getName(currency)}
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    {getName(currency)} ({currency})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories Tabs */}
        <div className="px-4 -mt-6 relative z-20">
          <div className="flex bg-white/60 backdrop-blur-md rounded-full p-1 shadow-sm overflow-x-auto hide-scrollbar border border-white justify-between">
            {[
              { id: "julaherb", label: "สินค้าจุฬาเฮิร์บ", icon: "🌱" },
              { id: "premium", label: "สินค้าพรีเมียม", icon: "💎" },
              { id: "lifestyle", label: "ไลฟสไตล์", icon: "🎟️" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-max px-3 py-2 text-[12px] font-bold rounded-full transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-[var(--jh-green)] text-white shadow-md shadow-green-500/20"
                    : "text-muted-foreground hover:bg-black/5"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rewards Grid */}
        <div className="px-4 mt-5 relative z-10">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((n) => (
                <Card key={n} className="border-0 shadow-sm overflow-hidden">
                  <div className="aspect-square bg-muted animate-pulse" />
                  <CardContent className="p-3">
                    <div className="h-4 bg-muted rounded w-full mb-2 animate-pulse" />
                    <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredRewards.length === 0 ? (
            <Card className="border-0 shadow-md animate-slide-up">
              <CardContent className="flex flex-col items-center py-16 px-6">
                <div className="w-20 h-20 mb-4 rounded-full bg-secondary flex items-center justify-center animate-float">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
                    <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-[var(--jh-green)]">ยังไม่มีของรางวัลในหมวดนี้</h3>
                <p className="text-sm text-muted-foreground mt-1 text-center">สะสมแต้มรอไว้ก่อนนะ เร็วๆ นี้จะมีของรางวัลมากมาย</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 stagger-children">
              {filteredRewards.map((r) => {
                const imgSrc = mediaUrl(r.image_url);
                const affordable = isLoggedIn() && canAfford(r.point_cost, r.cost_currency);
                const icon = getIcon(r.cost_currency);
                const currName = getName(r.cost_currency);

                return (
                  <Link key={r.id} href={`/rewards/${r.id}`}>
                    <Card className="border-0 shadow-sm overflow-hidden card-playful">
                      <div className="aspect-square bg-secondary relative overflow-hidden">
                        {imgSrc ? (
                          <Image
                            src={imgSrc}
                            alt={r.name}
                            fill
                            className="object-cover transition-transform duration-300 hover:scale-110"
                            sizes="50vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-[var(--jh-green-light)]/10">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-12 h-12 text-muted-foreground/30">
                              <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21" />
                            </svg>
                          </div>
                        )}

                        {r.is_flash && (
                          <Badge className="absolute top-2 left-2 bg-[var(--jh-pink)] text-white text-[10px] px-1.5 py-0 font-bold animate-pulse shadow-lg shadow-pink-500/30">
                            ⚡ FLASH
                          </Badge>
                        )}

                        {r.available_qty <= 10 && r.available_qty > 0 && (
                          <Badge className="absolute top-2 right-2 bg-[var(--jh-orange)] text-white text-[10px] px-1.5 py-0 shadow-md">
                            เหลือ {r.available_qty}
                          </Badge>
                        )}
                        {r.available_qty === 0 && (
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                            <span className="text-white font-bold text-sm bg-black/30 rounded-full px-4 py-1">หมดแล้ว</span>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-3">
                        <h3 className="text-[12px] font-semibold line-clamp-2 leading-tight min-h-[2.5em]">
                          {r.name}
                        </h3>

                        {deliveryLabel[r.delivery_type] && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {r.delivery_type === "shipping" ? "📦" : r.delivery_type === "coupon" ? "🎫" : r.delivery_type === "ticket" ? "🎟️" : r.delivery_type === "digital" ? "📱" : "📍"}{" "}
                            {deliveryLabel[r.delivery_type]}
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-[13px] font-bold relative group ${affordable ? "text-[var(--jh-green)]" : "text-foreground"}`}>
                            <span className="cursor-default">{icon}</span>{" "}
                            {r.point_cost.toLocaleString()}
                            <span className="absolute -top-6 left-0 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                              {currName}
                            </span>
                          </span>
                          {r.tier_name && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[var(--jh-gold)] text-[var(--jh-gold)] bg-[var(--jh-gold-light)]">
                              👑 {r.tier_name}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* History link */}
        {isLoggedIn() && (
          <div className="px-4 mt-6 animate-slide-up" style={{ animationDelay: "300ms" }}>
            <Link href="/history/redeems" className="block">
              <Card className="border-0 shadow-sm card-playful">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--jh-purple-light)] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-purple)" strokeWidth="2" className="w-5 h-5">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">ประวัติการแลกรางวัล</p>
                      <p className="text-xs text-muted-foreground">ดูสถานะการจัดส่งและคูปอง</p>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-muted-foreground">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
