"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  { ssr: false }
);

interface BalanceItem {
  currency: string;
  name: string;
  icon?: string;
  balance: number;
}

interface RewardItem {
  id: string;
  name: string;
  description: string;
  point_cost: number;
  image_url: string | null;
  delivery_type: string;
  available_qty: number;
  is_flash: boolean;
  flash_start: string | null;
  flash_end: string | null;
  tier_id: string | null;
  tier_name: string | null;
}

interface RewardDetail extends RewardItem {
  total_qty: number;
  reserved_qty: number;
  sold_qty: number;
  coupon_available_count?: number;
  type: string;
  campaign_id: string;
  created_at: string;
}

interface RedeemResponse {
  reservation_id: string;
  reward_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  confirmed_at?: string | null;
  delivery_type: string;
  coupon_code?: string | null;
  address_id?: string | null;
}

function formatCountdown(end: string | null): string {
  if (!end) return "";
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return "หมดเวลา";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} วัน`;
  if (h > 0) return `${h} ชม. ${m % 60} นาที`;
  return `${m} นาที`;
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RewardDetail | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");
  const [redeemResult, setRedeemResult] = useState<RedeemResponse | null>(null);
  const loggedIn = isLoggedIn();

  const totalPoints = balances.reduce((s, b) => s + b.balance, 0);

  const loadRewards = async () => {
    try {
      const res = await api.get<{ data: RewardItem[]; total: number }>("/api/v1/public/rewards");
      setRewards(res.data || []);
    } catch (err: unknown) {
      if (loggedIn) setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    if (!loggedIn) return;
    try {
      const res = await api.get<{ data: BalanceItem[] }>("/api/v1/my/balances");
      setBalances(res.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (loggedIn) {
      loadRewards();
      loadBalances();
    } else {
      setLoading(false);
    }
  }, [loggedIn]);

  const loadDetail = async (id: string) => {
    setDetailId(id);
    setDetail(null);
    try {
      const d = await api.get<RewardDetail>(`/api/v1/public/rewards/${id}`);
      setDetail(d);
    } catch {
      setDetailId(null);
    }
  };

  const handleRedeem = async (reward: RewardItem | RewardDetail) => {
    if (!loggedIn) {
      window.location.href = "/login";
      return;
    }
    if (totalPoints < reward.point_cost) {
      setError("คะแนนไม่เพียงพอ");
      return;
    }
    if (reward.available_qty <= 0) {
      setError("ของรางวัลหมดแล้ว");
      return;
    }
    if (!confirm(`แลก "${reward.name}" ด้วย ${reward.point_cost} คะแนน?`)) return;

    setRedeemingId(reward.id);
    setError("");
    setRedeemResult(null);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${reward.id}-${Date.now()}`;
      const result = await api.post<RedeemResponse>("/api/v1/redeem", { reward_id: reward.id }, idempotencyKey);
      setRedeemResult(result);
      if (result.coupon_code) {
        setSuccessMsg(`แลก "${reward.name}" สำเร็จ และรับโค้ดคูปองแล้ว`);
      } else if (result.delivery_type === "shipping") {
        setSuccessMsg(`แลก "${reward.name}" สำเร็จ ระบบบันทึกที่อยู่จัดส่งเริ่มต้นแล้ว`);
      } else {
        setSuccessMsg(`แลก "${reward.name}" สำเร็จ!`);
      }
      setTimeout(() => setSuccessMsg(""), 3000);
      await loadBalances();
      if (detailId === reward.id) {
        await loadDetail(reward.id);
      }
      setRewards((prev) =>
        prev.map((r) =>
          r.id === reward.id ? { ...r, available_qty: r.available_qty - 1 } : r
        )
      );
    } catch (err: unknown) {
      if (err instanceof ApiError && err.data.error === "default_address_required") {
        setError("กรุณาตั้งค่าที่อยู่จัดส่งเริ่มต้นในหน้าโปรไฟล์ก่อนแลกรางวัลนี้");
      } else if (err instanceof ApiError && err.data.error === "no_coupon_available") {
        setError("คูปองของรางวัลนี้หมดแล้ว");
      } else {
        setError(err instanceof Error ? err.message : "แลกไม่สำเร็จ");
      }
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-[#1976d2] to-[#1557b0] text-white px-5 pt-12 pb-6 rounded-b-[24px]">
        <h1 className="text-[22px] font-semibold">รางวัล</h1>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[13px] opacity-80">
            คะแนนของคุณ: <span className="font-bold">{totalPoints.toLocaleString()}</span>
          </p>
          {!loggedIn && (
            <Link href="/login" className="text-[12px] bg-white/20 px-3 py-1.5 rounded-[var(--radius-xl)]">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[var(--success-light)] border border-[var(--success)] rounded-[var(--radius-md)] p-3 text-center">
          <p className="text-[13px] font-medium text-[var(--success)]">{successMsg}</p>
        </div>
      )}

      {redeemResult?.coupon_code && (
        <div className="mx-5 mt-4 bg-white border-2 border-[#1976d2] rounded-2xl p-5">
          <p className="text-center text-[13px] font-medium text-[#1976d2] mb-4">Coupon Code ของคุณ</p>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border">
              <QRCodeSVG value={redeemResult.coupon_code} size={160} />
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <p className="text-[18px] font-bold text-[#1976d2] font-mono tracking-wider break-all">{redeemResult.coupon_code}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(redeemResult.coupon_code || ""); }}
              className="shrink-0 ml-3 h-[36px] px-4 bg-[#1976d2] text-white rounded-xl text-[12px] font-medium"
            >
              คัดลอก
            </button>
          </div>
          <p className="text-[11px] text-center text-[var(--on-surface-variant)] mt-3">แสดง QR Code นี้เพื่อใช้สิทธิ์ หรือกรอกรหัสด้านบน</p>
          <Link href="/history/redeems" className="block text-center mt-3 text-[12px] text-[#1976d2] font-medium underline">
            ดูประวัติการแลกทั้งหมด
          </Link>
        </div>
      )}

      {error && (
        <div className="mx-5 mt-4 p-3 bg-[var(--error-light)] rounded-[var(--radius-md)] text-[13px] text-[var(--error)] flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-[var(--error)] font-bold">×</button>
        </div>
      )}

      <div className="px-5 mt-6">
        {loading ? (
          <div className="text-center py-12">
            <svg className="animate-spin w-8 h-8 mx-auto text-[#1976d2]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : !loggedIn ? (
          <div className="text-center py-12 text-[var(--on-surface-variant)]">
            <p className="text-[14px] mb-4">กรุณาเข้าสู่ระบบเพื่อดูรางวัล</p>
            <Link href="/login" className="inline-block h-[44px] px-8 leading-[44px] bg-[#1976d2] text-white rounded-[var(--radius-xl)] text-[14px] font-medium">
              เข้าสู่ระบบ
            </Link>
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-12 text-[var(--on-surface-variant)]">
            <p className="text-[14px]">ยังไม่มีรางวัล</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rewards.map((r) => {
              const canAfford = totalPoints >= r.point_cost;
              const outOfStock = r.available_qty <= 0;
              const isTierLocked = !!r.tier_id;
              return (
                <div
                  key={r.id}
                  onClick={() => loadDetail(r.id)}
                  className="bg-white rounded-[var(--radius-lg)] elevation-1 overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="relative aspect-square bg-[var(--surface-container)]">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-[var(--on-surface-variant)] opacity-30">
                          <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
                        </svg>
                      </div>
                    )}
                    {r.is_flash && (
                      <span className="absolute top-2 left-2 bg-[var(--error)] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        FLASH
                      </span>
                    )}
                    {isTierLocked && (
                      <span className="absolute top-2 right-2 bg-[var(--on-surface-variant)] text-white p-1 rounded">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                      </span>
                    )}
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="inline-block bg-[#1976d2] text-white text-[12px] font-bold px-2 py-0.5 rounded">
                        {r.point_cost.toLocaleString()} pts
                      </span>
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="text-[13px] font-medium text-[var(--on-surface)] line-clamp-2">{r.name}</h3>
                    <p className="text-[11px] text-[var(--on-surface-variant)] mt-0.5">
                      เหลือ {r.available_qty} ชิ้น
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailId && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[24px] sm:rounded-[var(--radius-lg)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {detail ? (
              <>
                <div className="relative aspect-video bg-[var(--surface-container)]">
                  {detail.image_url ? (
                    <img src={detail.image_url} alt={detail.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-[var(--on-surface-variant)] opacity-30">
                        <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
                      </svg>
                    </div>
                  )}
                  {detail.is_flash && detail.flash_end && (
                    <div className="absolute top-3 left-3 bg-[var(--error)] text-white text-[12px] font-bold px-3 py-1 rounded">
                      FLASH — เหลือ {formatCountdown(detail.flash_end)}
                    </div>
                  )}
                  {detail.tier_id && (
                    <div className="absolute top-3 right-3 bg-[var(--on-surface-variant)] text-white text-[11px] px-2 py-1 rounded flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z" />
                      </svg>
                      {detail.tier_name || "Tier ล็อค"}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="text-[18px] font-semibold text-[var(--on-surface)]">{detail.name}</h2>
                  {detail.description && (
                    <p className="text-[14px] text-[var(--on-surface-variant)] mt-2">{detail.description}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <span className="text-[20px] font-bold text-[#1976d2]">{detail.point_cost.toLocaleString()}</span>
                      <span className="text-[12px] text-[var(--on-surface-variant)] ml-1">คะแนน</span>
                    </div>
                    <p className="text-[12px] text-[var(--on-surface-variant)]">
                      เหลือ {detail.available_qty} ชิ้น
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRedeem(detail);
                    }}
                    disabled={
                      redeemingId === detail.id ||
                      detail.available_qty <= 0 ||
                      totalPoints < detail.point_cost ||
                      !!detail.tier_id ||
                      !loggedIn
                    }
                    className="w-full mt-6 h-[48px] bg-[#1976d2] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                  >
                    {!loggedIn
                      ? "เข้าสู่ระบบเพื่อแลก"
                      : detail.tier_id
                      ? "ต้องเป็นสมาชิก Tier"
                      : detail.available_qty <= 0
                      ? "ของหมด"
                      : totalPoints < detail.point_cost
                      ? "คะแนนไม่พอ"
                      : redeemingId === detail.id
                      ? "กำลังแลก..."
                      : "แลกรางวัล"}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <svg className="animate-spin w-8 h-8 mx-auto text-[#1976d2]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            <button
              onClick={() => setDetailId(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
