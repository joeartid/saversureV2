"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function NotificationsPage() {
  return (
    <div className="pb-20">
      <Navbar />
      <PageRenderer pageSlug="notifications" />
      <BottomNav />
    </div>
  );
}
