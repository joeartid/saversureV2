"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import RedeemCard, { type RedeemEntry } from "@/components/RedeemCard";
import CouponSheet from "@/components/CouponSheet";

interface HistoryCouponsListProps {
  empty_title?: string;
  empty_text?: string;
  empty_cta_label?: string;
  empty_cta_link?: string;
  error_title?: string;
  error_text?: string;
  retry_label?: string;
  active_section_label?: string;
  used_section_label?: string;
}

const COUPON_TYPES = ["coupon", "digital", "ticket"];

export default function HistoryCouponsList({
  empty_title = "ยังไม่มีคูปองหรือสิทธิ์ดิจิทัล",
  empty_text = "แลกแต้มเพื่อรับคูปอง ตั๋ว หรือของรางวัลดิจิทัลที่หน้ารางวัล",
  empty_cta_label = "ไปที่หน้ารางวัล",
  empty_cta_link = "/rewards",
  error_title = "ไม่สามารถโหลดข้อมูลได้",
  error_text = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  retry_label = "ลองใหม่",
  active_section_label = "ใช้ได้",
  used_section_label = "ใช้แล้ว / หมดอายุ",
}: HistoryCouponsListProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [entries, setEntries] = useState<RedeemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<RedeemEntry | null>(
    null,
  );

  const fetchEntries = () => {
    setError(false);
    setLoading(true);
    api
      .get<{ data: RedeemEntry[] }>("/api/v1/my/redeem-transactions")
      .then((d) => {
        const filtered = (d.data || []).filter((e) =>
          COUPON_TYPES.includes(e.delivery_type || ""),
        );
        setEntries(filtered);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) {
      setLoading(false);
      return;
    }
    fetchEntries();
  }, []);

  const activeEntries = entries.filter(
    (e) => e.status !== "used" && e.status !== "expired",
  );
  const usedEntries = entries.filter(
    (e) => e.status === "used" || e.status === "expired",
  );

  if (!loggedIn) {
    return (
      <div className="px-4 mt-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--jh-green)"
                  strokeWidth="1.5"
                  className="w-10 h-10"
                >
                  <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 1115 0v.75H4.5v-.75z" />
                </svg>
              }
              title="กรุณาเข้าสู่ระบบ"
              subtitle="เข้าสู่ระบบเพื่อดูคูปองของคุณ"
              ctaLabel="เข้าสู่ระบบ"
              ctaHref="/login"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 mt-2">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                  <div className="h-9 w-24 bg-muted rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center py-12 px-6">
              <div className="w-16 h-16 mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-8 h-8 text-red-400"
                >
                  <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-base font-bold">{error_title}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 text-center">
                {error_text}
              </p>
              <button
                onClick={fetchEntries}
                className="rounded-full bg-[var(--jh-green)] px-6 py-2 text-sm font-bold text-white active:scale-95 transition-transform"
              >
                {retry_label}
              </button>
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <EmptyState
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--jh-green)"
                    strokeWidth="1.5"
                    className="w-10 h-10"
                  >
                    <path d="M15 5.25h1.5a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25v-12a2.25 2.25 0 012.25-2.25H4.5" />
                    <path d="M9 3.75h6v3H9v-3z" />
                  </svg>
                }
                title={empty_title}
                subtitle={empty_text}
                ctaLabel={empty_cta_label}
                ctaHref={empty_cta_link}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeEntries.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  {active_section_label} · {activeEntries.length} รายการ
                </p>
                <div className="space-y-2 stagger-children">
                  {activeEntries.map((e) => (
                    <CouponCard
                      key={e.id}
                      entry={e}
                      onUse={() => setSelectedCoupon(e)}
                    />
                  ))}
                </div>
              </div>
            )}

            {usedEntries.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  {used_section_label} · {usedEntries.length} รายการ
                </p>
                <div className="space-y-2 opacity-60">
                  {usedEntries.map((e) => (
                    <RedeemCard key={e.id} entry={e} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCoupon && (
        <CouponSheet
          couponCode={selectedCoupon.coupon_code || selectedCoupon.id}
          rewardName={selectedCoupon.reward_name || "คูปอง"}
          onClose={() => setSelectedCoupon(null)}
        />
      )}
    </>
  );
}

/* ─── Coupon Card with "ใช้คูปอง" button ─── */
function CouponCard({
  entry: e,
  onUse,
}: {
  entry: RedeemEntry;
  onUse: () => void;
}) {
  const deliveryIcons: Record<string, string> = {
    coupon: "🎫",
    digital: "📱",
    ticket: "🎟️",
  };
  const icon = deliveryIcons[e.delivery_type || ""] ?? "🎫";
  const imgSrc = e.reward_image_url
    ? e.reward_image_url.startsWith("http")
      ? e.reward_image_url
      : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400"}/media/${e.reward_image_url}`
    : null;

  const deliveryLabel: Record<string, string> = {
    coupon: "คูปอง",
    digital: "ดิจิทัล",
    ticket: "ตั๋ว",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden card-green-border">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-[var(--jh-green)]/5 ring-1 ring-gray-100 flex items-center justify-center">
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={e.reward_name || ""}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">{icon}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900 truncate leading-tight">
            {e.reward_name || "คูปอง"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-400">
              {new Date(e.created_at).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="text-[10px] bg-[var(--jh-green)]/10 text-[var(--jh-green)] px-1.5 py-0.5 rounded font-bold">
              {deliveryLabel[e.delivery_type || ""] ?? e.delivery_type}
            </span>
          </div>
        </div>

        <button
          onClick={onUse}
          className="shrink-0 flex items-center gap-1.5 bg-[var(--jh-green)] hover:bg-[var(--jh-green-dark)] active:scale-95 text-white text-[12px] font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm shadow-green-200/50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-3.5 h-3.5"
          >
            <path
              d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM16 16h4v4h-4z"
              strokeLinecap="round"
            />
          </svg>
          ใช้คูปอง
        </button>
      </div>

      {e.coupon_code && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-dashed border-gray-200">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--jh-green)"
            strokeWidth="1.5"
            className="w-3.5 h-3.5 shrink-0 opacity-70"
          >
            <path d="M15 5.25h1.5a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25v-12a2.25 2.25 0 012.25-2.25H4.5" />
          </svg>
          <p className="flex-1 font-mono text-[11px] font-bold text-gray-500 tracking-wider truncate">
            {e.coupon_code}
          </p>
          <span className="text-[10px] text-[var(--jh-green)] font-bold whitespace-nowrap">
            กดเพื่อใช้ →
          </span>
        </div>
      )}
    </div>
  );
}
