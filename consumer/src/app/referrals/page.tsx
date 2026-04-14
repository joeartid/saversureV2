"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { isLoggedIn, setPostLoginRedirect } from "@/lib/auth";

interface ReferralCode {
  id: string;
  code: string;
  uses: number;
  max_uses?: number | null;
  reward_referrer: number;
  reward_referee: number;
  active: boolean;
}

interface ReferralHistoryItem {
  id: string;
  referral_code: string;
  referee_name?: string | null;
  referee_id: string;
  points_given: number;
  created_at: string;
}

interface MyReferralOverview {
  code: ReferralCode | null;
  total_referrals: number;
  points_earned: number;
  recent_history: ReferralHistoryItem[];
}

export default function ReferralsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [overview, setOverview] = useState<MyReferralOverview | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await api.get<MyReferralOverview>("/api/v1/my/referrals/overview?limit=10");
      setOverview(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "โหลดข้อมูล referral ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      setPostLoginRedirect("/referrals");
      router.replace("/login");
      return;
    }
    void loadOverview();
  }, [router]);

  const referralLink = useMemo(() => {
    if (!overview?.code?.code) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/register?ref=${encodeURIComponent(overview.code.code)}`;
  }, [overview?.code?.code]);

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  };

  const handleShare = async () => {
    if (!overview?.code?.code) return;
    const shareText = `ใช้โค้ด ${overview.code.code} สมัคร Saversure แล้วรับ ${overview.code.reward_referee.toLocaleString()} แต้ม`;
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "ชวนเพื่อนรับแต้ม Saversure",
          text: shareText,
          url: referralLink,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${referralLink}`);
        toast.success("คัดลอกข้อความชวนเพื่อนแล้ว");
      }
    } catch {
      // ignore cancel
    } finally {
      setSharing(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      toast.error("กรุณากรอก referral code");
      return;
    }
    setApplying(true);
    try {
      await api.post("/api/v1/my/referrals/apply", { code: inputCode.trim().toUpperCase() });
      setInputCode("");
      await loadOverview();
      toast.success("ใช้ referral code สำเร็จ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ใช้ referral code ไม่สำเร็จ");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />
      <div className="pt-24">
        <PageHeader title="ชวนเพื่อน" subtitle="แชร์โค้ดเพื่อรับแต้มทั้งคุณและเพื่อน" backHref="/profile" />

        <div className="px-4 mt-6 space-y-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            {loading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs text-muted-foreground">เพื่อนที่ชวนสำเร็จ</p>
                    <p className="mt-2 text-2xl font-black text-[var(--jh-green)]">
                      {(overview?.total_referrals || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs text-muted-foreground">แต้มที่ได้จาก referral</p>
                    <p className="mt-2 text-2xl font-black text-[var(--jh-green)]">
                      {(overview?.points_earned || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-[var(--jh-green)] bg-[var(--jh-green)]/5 p-4">
                  <p className="text-xs text-muted-foreground">โค้ดของคุณ</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-2xl font-black tracking-[0.18em] text-[var(--jh-green)]">
                      {overview?.code?.code || "----"}
                    </p>
                    <button
                      type="button"
                      onClick={() => overview?.code?.code && void handleCopy(overview.code.code, "คัดลอกโค้ดแล้ว")}
                      className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--jh-green)] shadow-sm"
                    >
                      คัดลอก
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    เพื่อนได้ {overview?.code?.reward_referee?.toLocaleString() || 0} แต้ม และคุณได้ {overview?.code?.reward_referrer?.toLocaleString() || 0} แต้ม
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={sharing || !overview?.code?.code}
                      className="flex-1 rounded-2xl bg-[var(--jh-green)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {sharing ? "กำลังแชร์..." : "แชร์ให้เพื่อน"}
                    </button>
                    <button
                      type="button"
                      onClick={() => referralLink && void handleCopy(referralLink, "คัดลอกลิงก์แล้ว")}
                      className="rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-foreground"
                    >
                      คัดลอกลิงก์
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleApply} className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-foreground">มีโค้ดจากเพื่อน?</h2>
            <p className="mt-1 text-sm text-muted-foreground">กรอกโค้ดเพื่อรับแต้มต้อนรับเข้าระบบ</p>
            <input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="กรอก referral code"
              className="mt-4 h-12 w-full rounded-2xl border border-border bg-secondary px-4 text-base font-semibold tracking-[0.1em] uppercase outline-none"
            />
            <button
              type="submit"
              disabled={applying}
              className="mt-3 w-full rounded-2xl bg-[var(--jh-green)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {applying ? "กำลังตรวจสอบ..." : "ใช้โค้ด"}
            </button>
          </form>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-foreground">ประวัติการชวนเพื่อนล่าสุด</h2>
            {loading ? (
              <p className="mt-3 text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : overview?.recent_history?.length ? (
              <div className="mt-4 space-y-3">
                {overview.recent_history.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-secondary p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.referee_name || item.referee_id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString("th-TH")}
                        </p>
                      </div>
                      <p className="text-sm font-black text-[var(--jh-green)]">
                        +{item.points_given.toLocaleString()} แต้ม
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">ยังไม่มีเพื่อนที่ใช้โค้ดของคุณ</p>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
