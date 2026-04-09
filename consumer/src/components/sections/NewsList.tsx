"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { mediaUrl } from "@/lib/media";

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

interface NewsListProps {
  limit?: number;
  empty_title?: string;
  empty_text?: string;
  empty_cta_label?: string;
  empty_cta_link?: string;
  error_title?: string;
  error_text?: string;
  retry_label?: string;
  read_more_label?: string;
  show_banner_badge?: boolean;
}

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

export default function NewsList({
  limit = 50,
  empty_title = "ยังไม่มีข่าวสารใหม่",
  empty_text = "ติดตามโปรโมชั่น แคมเปญพิเศษ\nและกิจกรรมดีๆ ได้ที่นี่ เร็วๆ นี้",
  empty_cta_label = "กลับหน้าหลัก",
  empty_cta_link = "/",
  error_title = "ไม่สามารถโหลดข่าวสารได้",
  error_text = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  retry_label = "ลองใหม่",
  read_more_label = "อ่านเพิ่มเติม",
  show_banner_badge = true,
}: NewsListProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = () => {
    setError(false);
    setLoading(true);
    api
      .get<{ data: NewsItem[] }>(`/api/v1/public/news?limit=${limit}`)
      .then((res) => setNews(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return (
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-10 h-10 text-red-400"
              >
                <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold">{error_title}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 text-center leading-relaxed">
              {error_text}
            </p>
            <button
              onClick={fetchNews}
              className="rounded-full bg-[var(--jh-green)] px-8 py-2.5 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              {retry_label}
            </button>
          </CardContent>
        </Card>
      ) : news.length === 0 ? (
        <Card className="border-0 shadow-md animate-slide-up">
          <CardContent className="flex flex-col items-center py-16 px-6">
            <div className="w-20 h-20 mb-4 rounded-full bg-secondary flex items-center justify-center animate-float">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--jh-green)"
                strokeWidth="1.5"
                className="w-10 h-10"
              >
                <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--jh-green)]">
              {empty_title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 text-center leading-relaxed whitespace-pre-line">
              {empty_text}
            </p>
            <Link
              href={empty_cta_link}
              className="rounded-full bg-[var(--jh-green)] px-8 py-2.5 text-sm font-bold text-white"
            >
              {empty_cta_label}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 stagger-children">
          {news.map((item) => {
            const imgSrc = mediaUrl(item.image_url);
            const dateStr = formatDate(item.published_at || item.created_at);
            const hasContent = item.content && item.content.trim().length > 0;

            return (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="block"
              >
                <Card className="border-0 shadow-sm overflow-hidden card-playful cursor-pointer hover:shadow-md transition-shadow">
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
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            className="w-8 h-8 text-muted-foreground/30"
                          >
                            <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                          </svg>
                        </div>
                      )}
                      {show_banner_badge && item.type === "banner" && (
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
                        {hasContent && (
                          <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {truncateText(item.content, 80)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {dateStr}
                        </span>
                        <span className="text-[11px] text-[var(--jh-green)] font-medium inline-flex items-center gap-0.5">
                          {read_more_label}
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="w-3 h-3"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
