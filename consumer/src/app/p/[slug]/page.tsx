"use client";

import { use } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

export default function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />
      <div className="pt-24">
        <PageRenderer pageSlug={slug} />
      </div>
      <BottomNav />
    </div>
  );
}
