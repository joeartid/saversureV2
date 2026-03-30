"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface NewsItem {
  id: string;
  tenant_id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  position: number;
  type: string;
  status: string;
  published_at: string | null;
  created_at: string;
}

const mediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function truncateText(text: string | null, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: NewsItem[] }>("/api/v1/public/news?limit=50")
      .then((res) => setNews(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        {/* Header */}
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-14 text-white relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 animate-float" />
          <div className="absolute right-16 top-12 h-8 w-8 rounded-full bg-white/10 animate-float-delay-1" />
          <div className="absolute left-8 -bottom-4 h-16 w-16 rounded-full bg-white/5 animate-float-delay-2" />

          <h1 className="text-xl font-bold relative animate-slide-up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 inline-block mr-1.5 -mt-0.5">
              <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
            ข่าวสาร
          </h1>
          <p className="text-[13px] text-white/70 mt-1 relative animate-slide-up" style={{ animationDelay: "60ms" }}>
            โปรโมชั่นและข่าวสารล่าสุด
          </p>
        </div>

        {/* Content */}
        <div className="px-4 -mt-6 relative z-10">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <Card key={n} className="border-0 shadow-sm overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <div className="w-24 h-24 rounded-lg bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 py-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-full mb-1.5 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-2/3 mb-3 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="border-0 shadow-md animate-slide-up">
              <CardContent className="flex flex-col items-center py-16 px-6">
                <div className="w-20 h-20 mb-4 rounded-full bg-red-50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-red-400">
                    <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold">ไม่สามารถโหลดข่าวสารได้</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-6 text-center leading-relaxed">
                  เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง
                </p>
                <button
                  onClick={() => {
                    setError(false);
                    setLoading(true);
                    api
                      .get<{ data: NewsItem[] }>("/api/v1/public/news?limit=50")
                      .then((res) => setNews(res.data || []))
                      .catch(() => setError(true))
                      .finally(() => setLoading(false));
                  }}
                  className="rounded-full bg-[var(--jh-green)] px-8 py-2.5 text-sm font-bold text-white active:scale-95 transition-transform"
                >
                  ลองใหม่
                </button>
              </CardContent>
            </Card>
          ) : news.length === 0 ? (
            <Card className="border-0 shadow-md animate-slide-up">
              <CardContent className="flex flex-col items-center py-16 px-6">
                <div className="w-20 h-20 mb-4 rounded-full bg-secondary flex items-center justify-center animate-float">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
                    <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[var(--jh-green)]">ยังไม่มีข่าวสารใหม่</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-6 text-center leading-relaxed">
                  ติดตามโปรโมชั่น แคมเปญพิเศษ<br />และกิจกรรมดีๆ ได้ที่นี่ เร็วๆ นี้
                </p>
                <Link href="/" className="rounded-full bg-[var(--jh-green)] px-8 py-2.5 text-sm font-bold text-white">
                  กลับหน้าหลัก
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 stagger-children">
              {news.map((item) => {
                const imgSrc = mediaUrl(item.image_url);
                const isExpanded = expandedId === item.id;
                const dateStr = formatDate(item.published_at || item.created_at);
                const hasContent = item.content && item.content.trim().length > 0;

                return (
                  <Card
                    key={item.id}
                    className="border-0 shadow-sm overflow-hidden card-playful cursor-pointer"
                    onClick={() => hasContent && toggleExpand(item.id)}
                  >
                    {/* Compact card view */}
                    <div className="flex gap-3 p-3">
                      {/* Thumbnail */}
                      <div className="w-24 h-24 rounded-lg bg-secondary relative overflow-hidden flex-shrink-0">
                        {imgSrc ? (
                          <Image
                            src={imgSrc}
                            alt={item.title}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-[var(--jh-green-light)]/10">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-8 h-8 text-muted-foreground/30">
                              <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                            </svg>
                          </div>
                        )}
                        {item.type === "banner" && (
                          <span className="absolute top-1 left-1 bg-[var(--jh-orange)] text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                            BANNER
                          </span>
                        )}
                      </div>

                      {/* Text content */}
                      <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                        <div>
                          <h3 className="text-[14px] font-semibold text-foreground line-clamp-2 leading-tight">
                            {item.title}
                          </h3>
                          {!isExpanded && hasContent && (
                            <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {truncateText(item.content, 80)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {dateStr}
                          </span>
                          {hasContent && (
                            <span className="text-[11px] text-[var(--jh-green)] font-medium">
                              {isExpanded ? "ย่อ" : "อ่านเพิ่มเติม"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && hasContent && (
                      <div className="border-t border-border/50">
                        {/* Show full image if available */}
                        {imgSrc && (
                          <div className="relative w-full aspect-[2/1] bg-secondary">
                            <Image
                              src={imgSrc}
                              alt={item.title}
                              fill
                              className="object-cover"
                              sizes="100vw"
                            />
                          </div>
                        )}
                        <div className="px-4 py-4">
                          <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                            {item.content}
                          </p>
                          {item.link_url && (
                            <a
                              href={item.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-medium text-[var(--jh-green)] active:opacity-70"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                              ดูรายละเอียดเพิ่มเติม
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Link-only items (no content, but has link) */}
                    {!hasContent && item.link_url && (
                      <div className="px-3 pb-3 -mt-1">
                        <a
                          href={item.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--jh-green)]"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                            <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          ดูรายละเอียด
                        </a>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
