"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  { ssr: false }
);

interface RedeemEntry {
  id: string;
  reward_name: string | null;
  status: string;
  tracking: string | null;
  delivery_type: string | null;
  coupon_code: string | null;
  created_at: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "bg-[var(--warning-light)]", text: "text-[var(--warning)]" },
  CONFIRMED: { bg: "bg-[var(--info-light)]", text: "text-[var(--info)]" },
  SHIPPING: { bg: "bg-[#fff3e0]", text: "text-[#e65100]" },
  SHIPPED: { bg: "bg-[#e8f5e9]", text: "text-[#2e7d32]" },
  COMPLETED: { bg: "bg-[var(--success-light)]", text: "text-[var(--success)]" },
  EXPIRED: { bg: "bg-[var(--surface-container)]", text: "text-[var(--on-surface-variant)]" },
  CANCELLED: { bg: "bg-[var(--error-light)]", text: "text-[var(--error)]" },
};

function CouponDisplay({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-600">
            <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
          </svg>
          <span className="text-[12px] font-medium text-blue-700">Coupon Code</span>
        </div>
        <span className="text-[11px] text-blue-500">{expanded ? "ซ่อน" : "แสดง QR"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-4">
          <div className="flex justify-center mb-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <QRCodeSVG value={code} size={140} />
            </div>
          </div>
        </div>
      )}
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        <p className="text-[14px] font-bold font-mono text-blue-700 break-all">{code}</p>
        <button
          onClick={handleCopy}
          className="shrink-0 h-[30px] px-3 rounded-lg bg-blue-600 text-white text-[11px] font-medium"
        >
          {copied ? "✓ คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </div>
    </div>
  );
}

export default function RedeemHistoryPage() {
  const [entries, setEntries] = useState<RedeemEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    api
      .get<{ data: RedeemEntry[] }>("/api/v1/my/redeem-transactions")
      .then((d) => setEntries(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-[var(--primary)] to-[#1557b0] text-white px-5 pt-12 pb-6 rounded-b-[24px]">
        <h1 className="text-[22px] font-semibold">Redemption History</h1>
        <p className="text-[13px] opacity-80 mt-1">{entries.length} redemptions</p>
      </div>

      <div className="px-5 mt-6 space-y-2">
        {loading ? (
          <div className="text-center py-12">
            <svg className="animate-spin w-6 h-6 mx-auto text-[var(--on-surface-variant)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-[var(--on-surface-variant)]">
            <p className="text-[14px]">No redemptions yet</p>
          </div>
        ) : (
          entries.map((e) => {
            const s = statusColors[e.status] || statusColors.PENDING;
            return (
              <div key={e.id} className="bg-white rounded-[var(--radius-md)] elevation-1 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-[var(--on-surface)]">{e.reward_name || "Reward"}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
                    {e.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-[var(--on-surface-variant)]">
                    {new Date(e.created_at).toLocaleDateString()}
                  </p>
                  <div className="text-right">
                    {e.tracking && (
                      <p className="text-[11px] text-[var(--on-surface-variant)]">
                        Tracking: <span className="font-mono">{e.tracking}</span>
                      </p>
                    )}
                    {e.delivery_type && (
                      <p className="text-[10px] text-[var(--on-surface-variant)] capitalize">{e.delivery_type}</p>
                    )}
                  </div>
                </div>
                {e.coupon_code && (
                  <CouponDisplay code={e.coupon_code} />
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
