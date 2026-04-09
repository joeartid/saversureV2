"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function RewardsPage() {
  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />
      <div className="pt-24">
        <PageRenderer pageSlug="rewards" />
      </div>
      <BottomNav />
    </div>
  );
}
