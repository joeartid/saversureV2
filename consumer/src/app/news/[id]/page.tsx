"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";

interface NewsDetail {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  image_url?: string;
  type: string;
  published_at?: string;
}

const mediaUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

export default function NewsDetailPage() {
  const { id } = useParams();
  const [news, setNews] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get<NewsDetail>(`/api/v1/public/news/${id}`)
      .then((d) => setNews(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <div className="pt-24">
        {loading ? (
          <div className="p-4 space-y-4">
            <div className="h-48 bg-muted rounded-2xl animate-pulse" />
            <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-muted rounded w-full animate-pulse" />
          </div>
        ) : !news ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="text-5xl mb-4">📰</div>
            <h2 className="text-lg font-bold text-gray-700">ไม่พบข่าวนี้</h2>
            <p className="text-sm text-gray-400 mt-1">ข่าวอาจถูกลบหรือไม่มีอยู่ในระบบ</p>
            <Link href="/news" className="mt-4 text-sm font-semibold text-[var(--jh-green)] underline">
              กลับไปหน้าข่าวทั้งหมด
            </Link>
          </div>
        ) : (
          <div>
            {mediaUrl(news.image_url) && (
              <div className="relative w-full h-56">
                <Image src={mediaUrl(news.image_url)!} alt={news.title} fill className="object-cover" />
              </div>
            )}
            <div className="p-5">
              <div className="text-xs text-muted-foreground mb-2">
                {news.published_at
                  ? new Date(news.published_at).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : ""}
              </div>
              <h1 className="text-xl font-bold text-foreground mb-3">{news.title}</h1>
              <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {news.content || news.summary || "ไม่มีเนื้อหา"}
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
