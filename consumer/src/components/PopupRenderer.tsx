"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import DOMPurify from "dompurify";
import { api } from "@/lib/api";
import { useTenant } from "@/components/TenantProvider";

interface PopupData {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  trigger_type: string;
  frequency: string;
}

function getSeenKey(id: string) {
  return `popup_seen_${id}`;
}

function shouldShow(popup: PopupData): boolean {
  if (typeof window === "undefined") return false;

  const key = getSeenKey(popup.id);
  const seen = localStorage.getItem(key);

  if (popup.frequency === "once" && seen) return false;
  if (popup.frequency === "daily" && seen) {
    const today = new Date().toISOString().slice(0, 10);
    if (seen === today) return false;
  }
  return true;
}

function markSeen(popup: PopupData) {
  const key = getSeenKey(popup.id);
  if (popup.frequency === "daily") {
    localStorage.setItem(key, new Date().toISOString().slice(0, 10));
  } else {
    localStorage.setItem(key, "1");
  }
}

const mediaUrl = (url: string) => {
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

export default function PopupRenderer() {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const pathname = usePathname();
  const { tenantId, ready } = useTenant();

  useEffect(() => {
    if (!ready || !tenantId) return;

    const pageSlug = pathname === "/" ? "home" : pathname.replace("/", "");

    api
      .get<{ data: PopupData[] }>(
        `/api/v1/public/popups?page=${encodeURIComponent(pageSlug)}`,
      )
      .then((res) => {
        const candidates = (res.data || []).filter(
          (p) => p.trigger_type === "on_load" && shouldShow(p),
        );
        if (candidates.length > 0) {
          setPopup(candidates[0]);
        }
      })
      .catch(() => {});
  }, [pathname, ready, tenantId]);

  if (!popup) return null;

  const handleClose = () => {
    markSeen(popup);
    setPopup(null);
  };

  const handleClick = () => {
    markSeen(popup);
    if (popup.link_url) {
      window.location.href = popup.link_url;
    }
    setPopup(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-6">
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white text-lg"
        >
          &times;
        </button>

        {popup.image_url && (
          <div
            className="cursor-pointer"
            onClick={popup.link_url ? handleClick : undefined}
          >
            <img
              src={mediaUrl(popup.image_url)}
              alt={popup.title}
              className="w-full h-auto max-h-[300px] object-cover"
            />
          </div>
        )}

        <div className="p-5">
          <h3 className="text-lg font-bold text-gray-900">{popup.title}</h3>
          {popup.content && (
            <div
              className="mt-2 text-sm text-gray-600 leading-relaxed [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 [&_b]:font-bold [&_p]:mt-1"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(popup.content) }}
            />
          )}
          <div className="mt-4 flex gap-2">
            {popup.link_url && (
              <button
                onClick={handleClick}
                className="flex-1 rounded-full bg-[var(--jh-green)] py-2.5 text-sm font-bold text-white"
              >
                ดูรายละเอียด
              </button>
            )}
            <button
              onClick={handleClose}
              className={`rounded-full border border-gray-300 py-2.5 text-sm font-medium text-gray-600 ${popup.link_url ? "px-5" : "flex-1"}`}
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
