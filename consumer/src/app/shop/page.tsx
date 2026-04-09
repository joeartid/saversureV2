"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <div className="pt-24">
        <PageRenderer pageSlug="shop" />
      </div>
      <BottomNav />
    </div>
  );
}
