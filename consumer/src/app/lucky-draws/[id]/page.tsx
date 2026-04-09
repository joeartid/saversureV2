"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";

function DescriptionCard({ description }: { description: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!description) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 text-sm mb-2">รายละเอียดกิจกรรม</h3>
        <p className="text-[14px] text-gray-400 italic">ไม่มีรายละเอียดเพิ่มเติม</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-800 text-sm mb-2">รายละเอียดกิจกรรม</h3>
      <div
        className={`text-[13px] text-gray-600 leading-relaxed overflow-hidden transition-all duration-300 ${expanded ? "" : "max-h-[120px]"}`}
        style={{ WebkitMaskImage: expanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)" }}
        dangerouslySetInnerHTML={{ __html: description }}
      />
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-[13px] font-medium text-[var(--jh-green)] hover:underline"
      >
        {expanded ? "ย่อ" : "ดูเพิ่มเติม..."}
      </button>
    </div>
  );
}

interface LuckyDraw {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points: number;
  max_tickets_per_user: number;
  total_tickets: number;
  status: string;
  end_date: string | null;
  prize_count?: number;
  ticket_count?: number;
}

interface Prize {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  quantity: number;
}

export default function LuckyDrawDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<LuckyDraw | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<{ campaign: LuckyDraw; prizes: Prize[] }>(`/api/v1/public/lucky-draw/${id}`);
        setCampaign(res.campaign);
        setPrizes(res.prizes || []);
        if (isLoggedIn()) {
          const balRes = await api.get<{ data: { currency: string; balance: number }[] }>("/api/v1/my/balances");
          const pointBal = balRes.data?.find((b) => b.currency.toLowerCase() === "point");
          setPoints(pointBal?.balance ?? 0);
        }
      } catch {
        setCampaign(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleRegisterClick = () => {
    if (!campaign) return;
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    if (points < (campaign.cost_points || 0)) {
      alert("ขออภัย แต้มของคุณไม่เพียงพอสำหรับการลุ้นโชคนี้");
      return;
    }
    setShowConfirm(true);
  };

  const processRegister = async () => {
    if (!campaign) return;
    setShowConfirm(false);
    setRegistering(true);
    try {
      const res = await api.post<{ ticket_number: string }>(`/api/v1/my/lucky-draw/${campaign.id}/register`, {});
      setPoints((p) => p - (campaign.cost_points || 0));
      if (res?.ticket_number) {
        setTicketNumber(res.ticket_number);
      }
      setSuccess(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด หรือคุณมีตั๋วเต็มจำนวนโควต้าแล้ว");
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="pb-24 min-h-screen bg-gray-50 flex items-center justify-center">
        <Navbar />
        <div className="animate-spin text-[var(--primary)] text-4xl">
           <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[var(--primary)]"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="pb-24 min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Navbar />
        <p className="text-lg font-bold mb-4">ไม่พบกิจกรรม หรือกิจกรรมสิ้นสุดแล้ว</p>
        <Link href="/" className="bg-[var(--primary)] text-white px-6 py-2 rounded-full font-bold">กลับหน้าหลัก</Link>
        <BottomNav />
      </div>
    );
  }

  const imgSrc = mediaUrl(campaign.image_url);

  return (
    <div className="pb-36 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-[110px] left-4 z-20 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Image */}
        <div className="aspect-square bg-secondary relative overflow-hidden">
          {imgSrc ? (
            <Image src={imgSrc} alt={campaign.title} fill className="object-cover" sizes="100vw" priority />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
              <div className="text-6xl text-muted-foreground/20">🎁</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4">
          <div>
            <h1 className="text-base font-extrabold leading-tight text-gray-900">{campaign.title}</h1>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-lg font-bold text-[var(--jh-green)] relative group cursor-default flex items-center gap-1">
                <span className="text-xl">{'⭐'}</span> {(campaign.cost_points || 0).toLocaleString()}
                <span className="absolute -top-7 left-0 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  Point
                </span>
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                แต้ม / สิทธิ์
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span>🎫</span>
                <span>สูงสุด</span>
                <span className="font-bold text-gray-700">
                  {(campaign.max_tickets_per_user ?? 0).toLocaleString()}
                </span>
                <span>สิทธิ์/คน</span>
              </span>
              {prizes.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span>🎁</span>
                  <span className="font-bold text-gray-700">
                    {prizes.reduce((sum, p) => sum + (p.quantity ?? 0), 0).toLocaleString()}
                  </span>
                  <span>รางวัล</span>
                </span>
              )}
            </div>
          </div>

          <DescriptionCard description={campaign.description} />
        </div>
      </div>

      <div className="fixed bottom-[60px] left-0 right-0 z-40 bg-white/95 backdrop-blur-md p-4 app-fixed-bar shadow-[0_-4px_10px_rgba(0,0,0,0.05)] border-t border-gray-100 pb-safe">
        <div className="max-w-[480px] mx-auto flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">คงเหลือของคุณ</p>
            <p className="text-[18px] font-black flex items-center gap-1.5 mt-0.5 text-[var(--jh-green)]">
              <span className="text-lg">⭐</span> {points.toLocaleString()}
            </p>
          </div>
          
          <button
            onClick={handleRegisterClick}
            disabled={registering}
            className="flex-[1.5] bg-[var(--primary)] text-white font-bold h-12 rounded-xl shadow-[var(--primary)]/30 shadow-lg active:scale-95 transition-all text-sm flex justify-center items-center gap-2 disabled:opacity-50 !bg-orange-500 hover:!bg-orange-600 shadow-orange-500/30"
          >
            {registering ? "กำลังเพิ่มสิทธิ์..." : "แลกสิทธิ์ลุ้นโชค"}
          </button>
        </div>
      </div>

      <BottomNav />

      {showConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[320px] p-6 text-center shadow-2xl relative overflow-hidden animate-bounce-in">
            <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ❓
            </div>
            <h2 className="text-[20px] font-black text-gray-800 mb-2">ยืนยันการแลกสิทธิ์</h2>
            <p className="text-[14px] text-gray-600 mb-6 flex flex-col items-center">
              <span>คุณต้องการใช้ <span className="font-bold text-lg" style={{ color: "var(--primary)" }}>{(campaign.cost_points || 0).toLocaleString()}</span> แต้ม</span>
              <span>เพื่อแลกสิทธิ์ลุ้นโชคใช่หรือไม่?</span>
            </p>
            <div className="flex gap-3 relative z-10 w-full">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-[1] bg-gray-100 text-gray-600 font-bold text-[15px] rounded-xl py-3"
              >
                ยกเลิก
              </button>
              <button
                onClick={processRegister}
                className="flex-[1] bg-[var(--primary)] text-white font-bold text-[15px] rounded-xl py-3 !bg-orange-500 hover:!bg-orange-600"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-[320px] p-6 text-center shadow-2xl relative overflow-hidden animate-bounce-in">
            <div className="text-7xl mb-4 animate-wiggle inline-block">🎟️</div>
            <h2 className="text-[22px] font-black text-gray-800 mb-2">แลกสิทธิ์สำเร็จ!</h2>
            {ticketNumber && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl py-3 px-4 mb-4 mx-auto inline-block min-w-[200px]">
                <p className="text-[12px] text-orange-600 font-bold mb-1">หมายเลขตั๋วของคุณ</p>
                <p className="text-[20px] font-black text-orange-700 tracking-wider font-mono">{ticketNumber}</p>
              </div>
            )}
            <p className="text-[14px] text-gray-600 mb-6 px-1 leading-relaxed">
              คุณใช้ <span className="font-bold text-gray-800">{(campaign.cost_points || 0).toLocaleString()}</span> แต้ม เพื่อแลก <span className="font-bold text-gray-800">1</span> สิทธิ์ลุ้นโชคเรียบร้อย ขอให้โชคดีนะครับ!
            </p>
            <div className="flex flex-col gap-3 relative z-10">
              <Link
                href="/history/lucky-draw"
                className="w-full text-white font-bold text-[16px] rounded-xl py-3.5 shadow-md flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--primary)" }}
              >
                ดูประวัติสิทธิ์ลุ้นโชค
              </Link>
              <button
                onClick={() => setSuccess(false)}
                className="w-full bg-gray-100 text-gray-600 font-bold text-[15px] rounded-xl py-3"
              >
                แลกสิทธิ์เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
