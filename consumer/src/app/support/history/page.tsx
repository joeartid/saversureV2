"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

/* ---------- Types ---------- */
interface SupportCase {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  message_count: number;
  created_at: string;
  resolved_at?: string | null;
}

/* ---------- Constants ---------- */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open:              { label: "เปิด",       color: "text-blue-600",   bg: "bg-blue-50" },
  in_progress:       { label: "กำลังดำเนินการ", color: "text-amber-600", bg: "bg-amber-50" },
  waiting_customer:  { label: "รอลูกค้าตอบ",  color: "text-purple-600", bg: "bg-purple-50" },
  resolved:          { label: "แก้ไขแล้ว",   color: "text-green-600",  bg: "bg-green-50" },
  closed:            { label: "ปิดแล้ว",     color: "text-gray-500",   bg: "bg-gray-100" },
};

const CATEGORY_OPTIONS = [
  { value: "general",    label: "ทั่วไป" },
  { value: "points",     label: "เกี่ยวกับแต้มสะสม" },
  { value: "rewards",    label: "เกี่ยวกับของรางวัล" },
  { value: "account",    label: "บัญชีผู้ใช้" },
  { value: "scan",       label: "การสแกน QR" },
  { value: "other",      label: "อื่นๆ" },
];

/* ---------- Helpers ---------- */
function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status: string) {
  const s = STATUS_MAP[status] || STATUS_MAP.open;
  return s;
}

/* ---------- Components ---------- */

function TicketForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError("กรุณากรอกหัวข้อและรายละเอียด");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/v1/support/my-cases", {
        subject: subject.trim(),
        message: message.trim(),
        category,
        image_url: imageUrl.trim() || undefined,
      });
      setSuccess(true);
      setSubject("");
      setMessage("");
      setCategory("general");
      setImageUrl("");
      onCreated();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100/80 p-4 space-y-3">
      {/* Category */}
      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">
          หมวดหมู่
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--jh-green)]/30 focus:border-[var(--jh-green)] transition"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">
          หัวข้อ <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="เช่น สแกนแล้วไม่ได้แต้ม"
          maxLength={200}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--jh-green)]/30 focus:border-[var(--jh-green)] transition"
        />
      </div>

      {/* Message */}
      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">
          รายละเอียด <span className="text-red-400">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="อธิบายปัญหาที่พบ..."
          rows={4}
          maxLength={2000}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--jh-green)]/30 focus:border-[var(--jh-green)] transition resize-none"
        />
      </div>

      {/* Image URL (optional) */}
      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">
          ลิงก์รูปภาพ (ไม่บังคับ)
        </label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--jh-green)]/30 focus:border-[var(--jh-green)] transition"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          แนบลิงก์รูปภาพเพื่อประกอบการแจ้งปัญหา
        </p>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[12px] text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-[12px] text-green-600">
          ส่งเรื่องเรียบร้อยแล้ว ทีมงานจะตอบกลับโดยเร็ว
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] py-3 text-[14px] font-bold text-white shadow-md shadow-green-200/50 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            กำลังส่ง...
          </span>
        ) : (
          "ส่งเรื่องแจ้งปัญหา"
        )}
      </button>
    </form>
  );
}

function CaseCard({ c }: { c: SupportCase }) {
  const badge = getStatusBadge(c.status);
  const catLabel = CATEGORY_OPTIONS.find((o) => o.value === c.category)?.label || c.category;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100/80 p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-800 truncate">{c.subject}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400">{catLabel}</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">{formatDate(c.created_at)}</span>
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${badge.color} ${badge.bg}`}
        >
          {badge.label}
        </span>
      </div>
      {c.message_count > 1 && (
        <div className="flex items-center gap-1 mt-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-gray-400">
            <path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 1.2-.504 2.336-1.386 3.242-.476.49-.867.987-.868 1.636V18.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-.073c0-.648-.391-1.146-.868-1.636A4.862 4.862 0 0112 12a4.862 4.862 0 01-2.878.042c-.476.49-.867.987-.868 1.636V18.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-.073c0-.648-.391-1.146-.868-1.636A4.862 4.862 0 013 12a9 9 0 1118 0z" />
          </svg>
          <span className="text-[10px] text-gray-400">{c.message_count} ข้อความ</span>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
        </div>
        <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

/* ---------- Main Page Content ---------- */

function SupportHistoryContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "ticket" ? "ticket" : "history";

  const [activeTab, setActiveTab] = useState<"ticket" | "history">(initialTab);
  const [loggedIn, setLoggedIn] = useState(false);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCases = useCallback(async () => {
    try {
      const d = await api.get<{ data: SupportCase[] }>("/api/v1/support/my-cases");
      setCases(d.data ?? []);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลได้");
    }
  }, []);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) {
      setLoading(false);
      return;
    }
    fetchCases().finally(() => setLoading(false));
  }, [fetchCases]);

  const handleTicketCreated = () => {
    fetchCases();
    setActiveTab("history");
  };

  const openCount = cases.filter((c) => ["open", "in_progress", "waiting_customer"].includes(c.status)).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar />

      <div className="pt-24">
        {/* Header */}
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-10 text-white relative overflow-hidden">
          <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 animate-float" />
          <div className="absolute right-10 bottom-2 h-14 w-14 rounded-full bg-white/5 animate-float-delay-1" />
          <div className="absolute left-8 bottom-0 h-10 w-10 rounded-full bg-white/8 animate-float-delay-2" />

          <div className="relative flex items-center gap-3">
            <Link
              href="/profile"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-[40px] font-black tracking-tight leading-[1] mb-0 drop-shadow-md">แจ้งปัญหาและประวัติ</h1>
              {loggedIn && openCount > 0 && (
                <p className="text-[17px] font-medium text-white/95 -mt-1.5">
                  คุณมี {openCount} เรื่องที่ยังเปิดอยู่
                </p>
              )}
              {(!loggedIn || openCount === 0) && (
                <p className="text-[17px] font-medium text-white/95 -mt-1.5">ส่งคำร้องเรียนหรือแจ้งปัญหา</p>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="px-4 -mt-6 relative z-10">
          <div className="flex gap-1 bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-sm border border-gray-100">
            {([
              { key: "ticket" as const, label: "แจ้งปัญหา", icon: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" },
              { key: "history" as const, label: "ประวัติ", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-full py-2.5 text-center text-[12px] font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] text-white shadow-md shadow-green-200/50"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center justify-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path d={tab.icon} />
                  </svg>
                  {tab.label}
                  {tab.key === "history" && openCount > 0 && (
                    <span className={`ml-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                      activeTab === "history" ? "bg-white/30 text-white" : "bg-red-500 text-white"
                    }`}>
                      {openCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="px-4 mt-4 space-y-4">

          {/* Ticket Form Tab */}
          {activeTab === "ticket" && (
            <div className="animate-slide-up">
              {!loggedIn ? (
                <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center">
                  <div className="w-14 h-14 mb-4 rounded-full bg-gray-100 flex items-center justify-center animate-float">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-7 h-7">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-800">กรุณาเข้าสู่ระบบ</h3>
                  <p className="text-[12px] text-gray-400 mt-1 mb-5 text-center">
                    เข้าสู่ระบบเพื่อแจ้งปัญหาและติดตามสถานะ
                  </p>
                  <Link
                    href="/login"
                    className="rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] px-7 py-2 text-[13px] font-bold text-white shadow-md shadow-green-200/50"
                  >
                    เข้าสู่ระบบ
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--jh-green)]/10 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="2" className="w-3.5 h-3.5">
                        <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-bold text-gray-700">แจ้งปัญหาใหม่</p>
                  </div>
                  <TicketForm onCreated={handleTicketCreated} />
                </>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="animate-slide-up">
              {!loggedIn ? (
                <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center">
                  <div className="w-14 h-14 mb-4 rounded-full bg-gray-100 flex items-center justify-center animate-float">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-7 h-7">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-800">กรุณาเข้าสู่ระบบ</h3>
                  <p className="text-[12px] text-gray-400 mt-1 mb-5 text-center">
                    เข้าสู่ระบบเพื่อดูประวัติการแจ้งปัญหา
                  </p>
                  <Link
                    href="/login"
                    className="rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] px-7 py-2 text-[13px] font-bold text-white shadow-md shadow-green-200/50"
                  >
                    เข้าสู่ระบบ
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--jh-green)]/10 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="2" className="w-3.5 h-3.5">
                        <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-bold text-gray-700">ประวัติการแจ้งปัญหา</p>
                    {cases.length > 0 && (
                      <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {cases.length} รายการ
                      </span>
                    )}
                  </div>

                  {/* Loading */}
                  {loading && (
                    <div className="space-y-2">
                      {[1, 2, 3].map((n) => (
                        <SkeletonCard key={n} />
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {!loading && error && (
                    <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 text-center">
                      <p className="text-[13px] text-red-500">{error}</p>
                      <button
                        onClick={() => {
                          setError("");
                          setLoading(true);
                          fetchCases().finally(() => setLoading(false));
                        }}
                        className="mt-3 text-[12px] font-bold text-[var(--jh-green)]"
                      >
                        ลองใหม่
                      </button>
                    </div>
                  )}

                  {/* Empty */}
                  {!loading && !error && cases.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center">
                      <div className="w-14 h-14 mb-4 rounded-full bg-gray-100 flex items-center justify-center animate-float">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-7 h-7">
                          <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                        </svg>
                      </div>
                      <h3 className="text-[15px] font-bold text-gray-800">ยังไม่มีประวัติ</h3>
                      <p className="text-[12px] text-gray-400 mt-1 mb-5 text-center">
                        คุณยังไม่เคยแจ้งปัญหา
                      </p>
                      <button
                        onClick={() => setActiveTab("ticket")}
                        className="rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] px-7 py-2 text-[13px] font-bold text-white shadow-md shadow-green-200/50"
                      >
                        แจ้งปัญหาใหม่
                      </button>
                    </div>
                  )}

                  {/* Cases list */}
                  {!loading && !error && cases.length > 0 && (
                    <div className="space-y-2 stagger-children">
                      {cases.map((c) => (
                        <CaseCard key={c.id} c={c} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default function SupportHistoryPage() {
  return (
    <Suspense>
      <SupportHistoryContent />
    </Suspense>
  );
}
