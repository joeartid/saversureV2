"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

interface NewsItem {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  type: string;
  created_at: string;
}

export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ data: NewsItem }>(`/api/v1/public/news/${resolvedParams.id}`)
      .then((res) => {
        setNews(res.data || (res as unknown as NewsItem));
        setLoading(false);
      })
      .catch(() => {
        // Fallback: fetch from list
        api.get<{ data: NewsItem[] }>(`/api/v1/public/news?limit=100`)
          .then((res) => {
            const found = (res.data || []).find((n) => n.id === resolvedParams.id);
            if (found) {
              setNews(found);
            } else {
              setError("ไม่พบข้อมูลข่าวสารที่คุณต้องการ");
            }
          })
          .catch(() => {
            setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
          })
          .finally(() => {
            setLoading(false);
          });
      });
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen pb-24 bg-background">
        <Navbar />
        <div className="pt-24 px-4 space-y-4 max-w-lg mx-auto">
          <div className="w-full h-48 bg-gray-100 rounded-[24px] animate-pulse" />
          <div className="h-6 bg-gray-100 rounded w-3/4 animate-pulse mt-6" />
          <div className="h-4 bg-gray-100 rounded w-1/4 animate-pulse" />
          <div className="space-y-4 mt-8">
            <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-4/5 animate-pulse" />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error || !news) {
    return (
      <div className="min-h-screen pb-24 bg-background">
        <Navbar />
        <div className="pt-24 px-4 max-w-lg mx-auto">
          <PageHeader title="เกิดข้อผิดพลาด" backHref="/" />
          <div className="mt-10 flex flex-col items-center justify-center p-8 bg-white rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-[17px] font-bold text-gray-800 mb-2">อัปสสส!</h2>
            <p className="text-gray-500 font-medium text-[14px] text-center max-w-[200px]">
              {error || "ไม่พบข้อมูลข่าวสารที่คุณต้องการ"}
            </p>
            <button 
              onClick={() => router.push("/")}
              className="mt-6 w-full rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] p-3 text-[14px] font-bold text-white shadow-md shadow-green-200/50 hover:-translate-y-0.5 transition-all"
            >
              กลับไปหน้าแรก
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const imgSrc = mediaUrl(news.image_url);

  return (
    <div className="min-h-screen pb-24 bg-[#FCFCFD]">
      <Navbar />

      <div className="pt-[110px] pb-20 max-w-lg mx-auto bg-white min-h-screen shadow-[0_0_24px_rgba(0,0,0,0.02)] relative">
        <button 
          onClick={() => router.back()}
          className={`absolute top-[120px] left-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 shadow-[0_4px_12px_rgba(0,0,0,0.1)] backdrop-blur-md ${
            imgSrc ? "bg-black/30 text-white hover:bg-black/40" : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-100"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 ml-[-2px]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Hero Image */}
        {imgSrc && (
          <div className="w-full relative bg-gray-100 overflow-hidden">
            <img
              src={imgSrc}
              alt={news.title}
              className="w-full h-auto block"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-5 right-5 z-10">
              <span className={`inline-block px-3 py-1.5 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase tracking-widest shadow-sm ${
                news.type === "banner" ? "bg-[#EE4D2D]/80" : "bg-[var(--jh-green)]/80"
              }`}>
                {news.type === "banner" ? "PROMOTION" : "NEWS"}
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className={`px-6 ${imgSrc ? "pb-8 bg-white shrink-0 relative z-10 rounded-t-[32px] mt-2" : "pt-28 mt-0 pb-8"}`}>
          {imgSrc && (
            <div className="w-full flex justify-center py-4">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
          )}
          
          <h1 className={`${!imgSrc ? 'mt-4' : ''} text-[26px] sm:text-[32px] font-black text-gray-900 leading-[1.3] tracking-tight`}>
            {news.title}
          </h1>
          
          <div className="flex items-center gap-2 mt-4 pb-6 border-b border-gray-100">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-gray-800">ประกาศเมื่อ</p>
              <p className="text-[11px] text-gray-400 font-medium">
                {new Date(news.created_at).toLocaleDateString("th-TH", {
                  day: "numeric", month: "long", year: "numeric"
                })}
              </p>
            </div>
          </div>

          <div className="mt-6 pb-6">
            {news.content ? (
              <div 
                className="prose prose-sm prose-gray max-w-none 
                  prose-p:text-[15px] prose-p:leading-[1.8] prose-p:text-gray-600 prose-p:font-medium prose-p:mb-4
                  prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mb-3 prose-headings:mt-6
                  prose-a:text-[var(--jh-green)] prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-gray-800 prose-strong:font-bold
                  prose-li:text-gray-600 prose-li:font-medium prose-li:text-[15px]"
              >
                {news.content.includes('<') && news.content.includes('>') ? (
                  <div dangerouslySetInnerHTML={{ __html: news.content }} />
                ) : (
                  <p className="whitespace-pre-wrap">{news.content}</p>
                )}
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-[20px] border border-gray-100 border-dashed">
                <p className="text-[14px] text-gray-400 font-medium">ไม่มีรายละเอียดเพิ่มเติม</p>
              </div>
            )}
          </div>

          {news.link_url && (
            <div className="mt-2 flex justify-center sticky bottom-20 z-30">
              <Link 
                href={news.link_url}
                target="_blank"
                className="w-[calc(100%-24px)] rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] p-4 text-center text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(26,148,68,0.3)] hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                ดูรายละเอียดเพิ่มเติม 
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
