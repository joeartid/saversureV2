"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RedeemCard, { type RedeemEntry } from "@/components/RedeemCard";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

export default function RedeemHistoryPage() {
  const [entries, setEntries] = useState<RedeemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { setLoading(false); return; }
    api.get<{ data: RedeemEntry[] }>("/api/v1/my/redeem-transactions")
      .then((d) => setEntries(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        <PageHeader
          title="ประวัติการแลกแต้ม"
          subtitle={entries.length > 0 ? `${entries.length} รายการ` : undefined}
        />

        {/* Tab links */}
        <div className="px-4 -mt-8 relative z-10">
          <Card className="border-0 shadow-md mb-3">
            <CardContent className="p-3">
              <div className="flex gap-2">
                <Link href="/history" className="flex-1 rounded-full border border-border bg-white py-2 text-center text-sm font-semibold text-muted-foreground">
                  แต้มสะสม
                </Link>
                <Link href="/history/redeems" className="flex-1 rounded-full bg-[var(--jh-green)] py-2 text-center text-sm font-semibold text-white">
                  แลกรางวัล
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="px-4 mt-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <EmptyState
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
                      <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  }
                  title="ยังไม่มีประวัติการแลกรางวัล"
                  subtitle="สะสมแต้มเพื่อนำมาแลกของรางวัลและสิทธิพิเศษ"
                  ctaLabel="ดูของรางวัล"
                  ctaHref="/rewards"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 stagger-children">
              {entries.map((e) => (
                <RedeemCard
                  key={e.id}
                  entry={e}
                  expanded={expandedId === e.id}
                  onToggleDetail={handleToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
