"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import HistoryTabs from "@/components/HistoryTabs";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

export default function DonationsHistoryPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { setLoading(false); return; }
    // Simulated API call for missions history
    setTimeout(() => setLoading(false), 800);
  }, []);

  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        <PageHeader
          title="ประวัติการบริจาค"
          subtitle="โครงการที่คุณร่วมบริจาคด้วยแต้มสะสม"
        />

        <HistoryTabs />

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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-sm animate-slide-up">
              <CardContent className="p-0">
                <EmptyState
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  }
                  title="ยังไม่มีประวัติการบริจาค"
                  subtitle="ร่วมแบ่งปันรอยยิ้มด้วยการบริจาคแต้มสะสม"
                  ctaLabel="ดูโครงการบริจาค"
                  ctaHref="/"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
