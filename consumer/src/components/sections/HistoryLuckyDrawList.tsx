"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";

interface LuckyDrawTicket {
  id: string;
  campaign_id: string;
  campaign_title: string;
  ticket_number: string;
  created_at: string;
  status: string;
}

interface HistoryLuckyDrawListProps {
  empty_title?: string;
  empty_text?: string;
  empty_cta_label?: string;
  empty_cta_link?: string;
  error_title?: string;
  error_text?: string;
  retry_label?: string;
  count_label?: string;
  status_label_active?: string;
  status_label_won?: string;
  ticket_number_label?: string;
  ticket_type_label?: string;
}

export default function HistoryLuckyDrawList({
  empty_title = "ยังไม่มีสิทธิ์ลุ้นโชค",
  empty_text = "ร่วมกิจกรรมลุ้นโชคเพื่อรับสิทธิ์",
  empty_cta_label = "ดูกิจกรรม",
  empty_cta_link = "/missions",
  error_title = "ไม่สามารถโหลดข้อมูลได้",
  error_text = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  retry_label = "ลองใหม่",
  count_label = "พบ {n} สิทธิ์ลุ้นโชค",
  status_label_active = "รอการจับรางวัล",
  status_label_won = "ได้รับรางวัล",
  ticket_number_label = "หมายเลขตั๋ว",
  ticket_type_label = "ตั๋ว",
}: HistoryLuckyDrawListProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tickets, setTickets] = useState<LuckyDrawTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTickets = () => {
    setError(false);
    setLoading(true);
    api
      .get<{ data: LuckyDrawTicket[] }>("/api/v1/my/lucky-draw/tickets")
      .then((res) => setTickets(res.data || []))
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
    fetchTickets();
  }, []);

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
              subtitle="เข้าสู่ระบบเพื่อดูประวัติการลุ้นโชคของคุณ"
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
              onClick={fetchTickets}
              className="rounded-full bg-[var(--jh-green)] px-6 py-2 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              {retry_label}
            </button>
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={<span className="text-4xl">🎟️</span>}
              title={empty_title}
              subtitle={empty_text}
              ctaLabel={empty_cta_label}
              ctaHref={empty_cta_link}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-gray-600 mb-2 px-1">
            {count_label.replace("{n}", String(tickets.length))}
          </div>
          <div className="space-y-2 stagger-children">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden card-green-border"
              >
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-[var(--jh-green)]/5 ring-1 ring-gray-100 flex items-center justify-center">
                    <span className="text-2xl">🎟️</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 truncate leading-tight">
                      {ticket.campaign_title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-400">
                        {new Date(ticket.created_at).toLocaleDateString(
                          "th-TH",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </span>
                      <span className="text-[10px] bg-[var(--jh-green)]/10 text-[var(--jh-green)] px-1.5 py-0.5 rounded font-bold">
                        {ticket_type_label}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ticket.status === "active"
                          ? "bg-green-100 text-green-700"
                          : ticket.status === "won"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {ticket.status === "active"
                        ? status_label_active
                        : ticket.status === "won"
                          ? status_label_won
                          : ticket.status}
                    </span>
                  </div>
                </div>

                <div className="mx-4 mb-3 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-dashed border-gray-200">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--jh-green)"
                    strokeWidth="1.5"
                    className="w-3.5 h-3.5 shrink-0 opacity-70"
                  >
                    <path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.118l-12.75 1.062a2.126 2.126 0 01-2.298-2.118v-8.5c0-1.094.787-2.036 1.872-2.118l1.063-.088" />
                  </svg>
                  <p className="flex-1 font-mono text-[11px] font-bold text-gray-500 tracking-wider truncate">
                    {ticket.ticket_number}
                  </p>
                  <span className="text-[10px] text-[var(--jh-green)] font-bold whitespace-nowrap">
                    {ticket_number_label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
