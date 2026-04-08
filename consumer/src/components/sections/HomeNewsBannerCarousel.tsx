"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  image_url?: string;
  banner_image?: string;
  type: string;
}

interface Props {
  limit?: number;
  auto_play?: boolean;
  interval_ms?: number;
  show_dots?: boolean;
}

export default function HomeNewsBannerCarousel({
  limit = 5,
  auto_play = true,
  interval_ms = 3000,
  show_dots = true,
}: Props) {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  useEffect(() => {
    api
      .get<{ data: NewsItem[] }>(`/api/v1/public/news?limit=${limit}`)
      .then((d) => setNewsList(d.data || []))
      .catch(() => {});
  }, [limit]);

  useEffect(() => {
    if (!auto_play || newsList.length <= 1) return;
    const t = setInterval(
      () => setBannerIdx((p) => (p + 1) % newsList.length),
      interval_ms,
    );
    return () => clearInterval(t);
  }, [auto_play, interval_ms, newsList.length]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };
  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  const banners = newsList.length > 0 ? newsList : null;

  return (
    <div className="jh-banner-section">
      <div
        className="jh-banner-scroll cursor-grab active:cursor-grabbing"
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        style={{ scrollSnapType: isDragging ? "none" : "x mandatory" }}
      >
        {banners
          ? banners.map((news) => {
              const img = mediaUrl(news.banner_image || news.image_url);
              return (
                <Link
                  key={news.id}
                  href={`/news/${news.id}`}
                  className="jh-banner-slide"
                >
                  {img ? (
                    <Image
                      src={img}
                      alt={news.title}
                      width={240}
                      height={112}
                      className="jh-banner-img"
                    />
                  ) : (
                    <div className="jh-banner-placeholder">{news.title}</div>
                  )}
                </Link>
              );
            })
          : [
              { title: "คำถามที่พบบ่อย เกี่ยวกับการสแกนสินค้า" },
              { title: "สะสมแต้มแลกรางวัล สแกน QR Code รับแต้มทันที!" },
            ].map((b, i) => (
              <div key={i} className="jh-banner-slide">
                <div className="jh-banner-placeholder">{b.title}</div>
              </div>
            ))}
        <div style={{ width: 16, flexShrink: 0 }}>&nbsp;</div>
      </div>
      {show_dots && (
        <div className="jh-banner-dots">
          {(banners || [null, null]).map((_, i) => (
            <div
              key={i}
              className={`jh-dot ${i === bannerIdx ? "active" : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
