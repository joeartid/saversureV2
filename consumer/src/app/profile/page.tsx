"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function ProfilePage() {
  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />
      <div className="pt-24">
        <PageRenderer pageSlug="profile" />
      </div>
      <BottomNav />
    </div>
  );
}
