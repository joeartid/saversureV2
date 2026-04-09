"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar />
      <div className="pt-24">
        <PageRenderer pageSlug="history" />
      </div>
      <BottomNav />
    </div>
  );
}
