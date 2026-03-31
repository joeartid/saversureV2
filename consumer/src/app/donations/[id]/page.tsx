"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface Donation {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_points: number;
  collected_points: number;
  status: string;
  donor_count: number;
}

const PRESETS = [10, 50, 100, 500];

export default function DonationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [donation, setDonation] = useState<Donation | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [donateAmount, setDonateAmount] = useState<number>(0);
  const [donating, setDonating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    loadDonation();
    if (isLoggedIn()) {
      api.get<{ data: { currency: string; balance: number }[] }>("/api/v1/my/balances")
        .then((d) => {
          const pointBal = d.data?.find(b => b.currency.toLowerCase() === "point");
          setPoints(pointBal?.balance ?? 0);
        })
        .catch(() => {});
    }
  }, [id]);

  const loadDonation = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Donation[] }>("/api/v1/public/donations");
      const found = res.data?.find(d => d.id === id);
      if (found) {
        setDonation(found);
      } else {
        router.push("/donations");
      }
    } catch {
      router.push("/donations");
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = async () => {
    if (!donation || donateAmount <= 0) return;
    if (!isLoggedIn()) {
      alert("กรุณาเข้าสู่ระบบก่อนร่วมบริจาค");
      return;
    }
    if (points < donateAmount) {
      alert("แต้มของคุณไม่เพียงพอ");
      return;
    }

    setDonating(true);
    try {
      await api.post(`/api/v1/my/donations/${donation.id}/donate`, { points: donateAmount });
      setSuccessMsg("ร่วมบริจาคสำเร็จ! ขอบคุณที่ร่วมทำบุญกับเรา");
      setTimeout(() => setSuccessMsg(""), 3000);
      setDonateAmount(0);
      setPoints((p) => p - donateAmount);
      setDonation(s => s ? {
        ...s,
        collected_points: s.collected_points + donateAmount,
        donor_count: s.donor_count + 1,
      } : null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบริจาค");
    } finally {
      setDonating(false);
    }
  };

  if (loading) {
     return (
        <div className="pb-20">
          <Navbar />
          <div className="flex justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-[var(--primary)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <BottomNav />
        </div>
     )
  }

  if (!donation) return null;

  const progress = donation.target_points > 0 ? Math.min(100, (donation.collected_points / donation.target_points) * 100) : 0;

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <Navbar />
      <div className="bg-white sticky top-[97px] z-10 border-b border-[var(--outline-variant)] shadow-sm">
        <div className="max-w-[480px] mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="text-[var(--on-surface)]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <h1 className="text-[18px] font-semibold text-[var(--on-surface)] truncate">{donation.title}</h1>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-5 py-5 space-y-5">
        <div className="relative w-full aspect-square bg-muted rounded-[var(--radius-lg)] overflow-hidden shadow-sm">
          {donation.image_url ? (
            <img
              src={donation.image_url.startsWith('http') ? donation.image_url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:30400'}/media/${donation.image_url}`}
              alt={donation.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-[var(--primary-light)]">
              <svg viewBox="0 0 24 24" fill="var(--primary)" className="w-16 h-16 opacity-50">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-[20px] font-bold text-[var(--on-surface)]">{donation.title}</h2>
          {donation.description && (
            <p className="text-[14px] text-[var(--on-surface-variant)] mt-2 whitespace-pre-wrap leading-relaxed">
              {donation.description}
            </p>
          )}
        </div>

        <div className="bg-white rounded-[var(--radius-lg)] shadow-sm p-4 border border-gray-100">
          <div className="flex justify-between text-[14px] text-[var(--on-surface-variant)] mb-2">
            <span>สะสมแล้ว {donation.collected_points.toLocaleString()} / {donation.target_points.toLocaleString()} แต้ม</span>
            <span>{donation.donor_count} ผู้บริจาค</span>
          </div>
          <div className="h-2 bg-[var(--outline-variant)] rounded-[var(--radius-sm)] overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-[var(--radius-sm)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {successMsg && (
          <div className="bg-[var(--success-light)] border border-[var(--success)] rounded-[var(--radius-lg)] p-3 text-center">
            <p className="text-[14px] font-bold text-[var(--success)]">{successMsg}</p>
          </div>
        )}

        {isLoggedIn() ? (
          <div className="bg-white rounded-[var(--radius-lg)] shadow-sm border border-gray-100 p-4 space-y-4">
            <h3 className="text-[16px] font-bold text-[var(--on-surface)]">ร่วมบริจาคด้วยแต้ม</h3>
            <p className="text-[13px] text-[var(--on-surface-variant)]">แต้มคงเหลือของคุณ: <span className="font-bold text-[var(--jh-green)]">{points.toLocaleString()} แต้ม</span></p>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDonateAmount(p)}
                  className="h-[36px] px-4 rounded-[var(--radius-xl)] text-[14px] font-bold bg-[var(--primary-light)] text-[var(--primary)] active:scale-[0.95]"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                value={donateAmount || ""}
                onChange={(e) => setDonateAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="ระบุจำนวนแต้ม"
                className="flex-1 h-[44px] px-4 rounded-[var(--radius-lg)] border border-[var(--outline-variant)] text-[var(--on-surface)] bg-white text-[15px]"
              />
              <button
                onClick={() => setDonateAmount(0)}
                className="h-[44px] px-4 rounded-[var(--radius-lg)] text-[13px] text-[var(--on-surface-variant)] font-bold"
              >
                ล้าง
              </button>
            </div>
            <button
              onClick={handleDonate}
              disabled={donating || donateAmount <= 0 || points < donateAmount}
              className="w-full h-[48px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[16px] font-bold disabled:opacity-50 mt-4 shadow-sm"
            >
              {donating ? "กำลังทำรายการ..." : donateAmount > 0 ? `บริจาค ${donateAmount.toLocaleString()} แต้ม` : "ร่วมบริจาค"}
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="block w-full h-[48px] leading-[48px] text-center bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[16px] font-bold"
          >
            เข้าสู่ระบบเพื่อร่วมบริจาค
          </Link>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
