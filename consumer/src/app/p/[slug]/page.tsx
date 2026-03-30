"use client";

import { use } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageRenderer from "@/components/PageRenderer";

function NotFoundFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4 opacity-40">📄</div>
      <h2 className="text-lg font-bold text-foreground">ไม่พบหน้านี้</h2>
      <p className="text-sm text-muted-foreground mt-1">
        หน้านี้ยังไม่ได้ถูกสร้าง หรืออยู่ระหว่างการเตรียมข้อมูล
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-full bg-[var(--jh-green)] px-6 py-2.5 text-sm font-semibold text-white"
      >
        กลับหน้าหลัก
      </a>
    </div>
  );
}

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
        <PageRenderer pageSlug={slug} fallback={<NotFoundFallback />} />
      </div>
      <BottomNav />
    </div>
  );
}
