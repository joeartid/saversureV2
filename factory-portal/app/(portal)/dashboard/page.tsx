"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getUser } from "@/lib/api";

interface Stats {
  pending_print: number;
  printed: number;
  mapped: number;
  qc_approved: number;
  qc_rejected: number;
  distributed: number;
  recalled: number;
  total: number;
}

// total = pending_print + printed + mapped + qc_approved + qc_rejected + distributed + recalled
// 4 card แสดงเฉพาะ printed+mapped+qc_approved+qc_rejected (กำลังดำเนินการ)
// pending_print/distributed/recalled แสดงแยกในหัวข้อรวม

const statCards = [
  {
    key: "printed" as keyof Stats,
    label: "รอ Map สินค้า",
    sublabel: "ม้วนที่ได้รับ assign แล้ว",
    bg: "bg-blue-50 dark:bg-blue-950",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    icon: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  },
  {
    key: "mapped" as keyof Stats,
    label: "รอ QC",
    sublabel: "Map แล้ว รอตรวจสอบ",
    bg: "bg-amber-50 dark:bg-amber-950",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    icon: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  },
  {
    key: "qc_approved" as keyof Stats,
    label: "QC ผ่าน",
    sublabel: "พร้อมจัดส่ง",
    bg: "bg-green-50 dark:bg-green-950",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  },
  {
    key: "qc_rejected" as keyof Stats,
    label: "QC ไม่ผ่าน",
    sublabel: "ต้อง Map ใหม่",
    bg: "bg-red-50 dark:bg-red-950",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = typeof window !== "undefined" ? getUser() : null;

  useEffect(() => {
    api.get<Stats>("/api/v1/rolls/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-[var(--md-on-surface)] tracking-[-0.5px]">
          Dashboard
        </h1>
        <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
          สวัสดี — ภาพรวมม้วนสติ๊กเกอร์ของโรงงานคุณ
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-8 h-8 text-[var(--md-on-surface-variant)]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : stats ? (
        <>
          {/* Total */}
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-6 mb-6">
            <p className="text-[13px] text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] font-medium mb-2">
              ม้วนทั้งหมดที่ได้รับ assign
            </p>
            <p className="text-[48px] font-bold text-[var(--md-primary)] leading-none">
              {stats.total.toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {stats.pending_print > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                  รอพิมพ์ {stats.pending_print.toLocaleString()} ม้วน
                  <span className="text-[11px] opacity-60">(ยังดำเนินการไม่ได้)</span>
                </span>
              )}
              {stats.distributed > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  จัดส่งแล้ว {stats.distributed.toLocaleString()} ม้วน
                </span>
              )}
              {stats.recalled > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-purple-600 dark:text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                  เรียกคืนแล้ว {stats.recalled.toLocaleString()} ม้วน
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--md-on-surface-variant)]">
                <span className="w-2 h-2 rounded-full bg-[var(--md-primary)] inline-block" />
                กำลังดำเนินการ {(stats.printed + stats.mapped + stats.qc_approved + stats.qc_rejected).toLocaleString()} ม้วน
              </span>
            </div>
          </div>

          {/* Active stat cards — ไม่รวม pending_print/distributed/recalled */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {statCards.map(({ key, label, sublabel, bg, text, border, icon }) => (
              <Link
                key={key}
                href={`/rolls?status=${key}`}
                className={`p-5 rounded-[var(--md-radius-xl)] border-2 ${bg} ${border} flex items-center gap-4 hover:opacity-80 transition-all`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${text} bg-white/40 dark:bg-black/20 shrink-0`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d={icon} />
                  </svg>
                </div>
                <div>
                  <p className={`text-[32px] font-bold leading-none ${text}`}>
                    {(stats[key] as number).toLocaleString()}
                  </p>
                  <p className={`text-[13px] font-medium ${text} mt-0.5`}>{label}</p>
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">{sublabel}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick action */}
          {(stats.printed > 0 || stats.qc_rejected > 0) && (
            <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-200 dark:border-amber-800 rounded-[var(--md-radius-xl)] p-5 flex items-center justify-between">
              <div>
                <p className="text-[15px] font-semibold text-amber-700 dark:text-amber-300">
                  มีม้วนที่รอ Map อยู่ {stats.printed + stats.qc_rejected} ม้วน
                </p>
                <p className="text-[13px] text-amber-600 dark:text-amber-400 mt-0.5">
                  กรุณา Map สินค้าให้ครบก่อนส่งกลับ
                </p>
              </div>
              <Link
                href="/rolls?status=printed"
                className="h-[40px] px-5 bg-amber-600 text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-amber-700 transition-all shrink-0"
              >
                ไป Map สินค้า
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-[var(--md-on-surface-variant)]">
          ไม่สามารถโหลดข้อมูลได้
        </div>
      )}
    </div>
  );
}
