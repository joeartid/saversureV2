"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function MyCouponsHistoryPage() {
  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />
      <div className="pt-24">
        <PageRenderer pageSlug="history_coupons" />
      </div>
      <BottomNav />
    </div>
  );
}
