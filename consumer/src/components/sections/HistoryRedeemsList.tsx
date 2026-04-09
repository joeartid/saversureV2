"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import RedeemCard, { type RedeemEntry } from "@/components/RedeemCard";

interface HistoryRedeemsListProps {
  empty_title?: string;
  empty_text?: string;
  empty_cta_label?: string;
  empty_cta_link?: string;
  error_title?: string;
  error_text?: string;
  retry_label?: string;
}

const PHYSICAL_TYPES = ["shipping", "pickup"];

export default function HistoryRedeemsList({
  empty_title = "ยังไม่มีประวัติการแลกรางวัล",
  empty_text = "สะสมแต้มเพื่อนำมาแลกของรางวัลและสิทธิพิเศษ",
  empty_cta_label = "ดูของรางวัล",
  empty_cta_link = "/rewards",
  error_title = "ไม่สามารถโหลดข้อมูลได้",
  error_text = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  retry_label = "ลองใหม่",
}: HistoryRedeemsListProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [entries, setEntries] = useState<RedeemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = () => {
    setError(false);
    setLoading(true);
    api
      .get<{ data: RedeemEntry[] }>("/api/v1/my/redeem-transactions")
      .then((d) => {
        const physical = (d.data || []).filter((e) =>
          PHYSICAL_TYPES.includes(e.delivery_type || ""),
        );
        setEntries(physical);
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

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

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
              subtitle="เข้าสู่ระบบเพื่อดูประวัติการแลกรางวัลของคุณ"
              ctaLabel="เข้าสู่ระบบ"
              ctaHref="/login"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
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
                <div className="h-5 w-16 bg-muted rounded-full" />
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
                  <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
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
        <div className="space-y-2 stagger-children">
          {entries.map((e) => (
            <RedeemCard
              key={e.id}
              entry={e}
              expanded={expandedId === e.id}
              onToggleDetail={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
