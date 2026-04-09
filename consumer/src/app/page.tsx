"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-24 relative z-0">
        <PageRenderer pageSlug="home" />
      </div>
      <BottomNav />
    </div>
  );
}
