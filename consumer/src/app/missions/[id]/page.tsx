"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

interface Mission {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  type: string;
  condition: string;
  reward_type: string;
  reward_points: number;
  reward_badge_id?: string | null;
  reward_currency: string;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
}

interface UserMission {
  mission_id: string;
  progress: number;
  target: number;
  completed: boolean;
  completed_at?: string | null;
  rewarded: boolean;
  mission?: Mission;
}

interface ConditionRule {
  description?: string;
  type?: string;
  target?: number;
  [key: string]: unknown;
}

const mediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

function parseRules(conditionStr: string): string[] {
  try {
    const parsed = JSON.parse(conditionStr);
    if (Array.isArray(parsed)) {
      return parsed.map((r: ConditionRule) => r.description || JSON.stringify(r));
    }
    if (parsed.rules && Array.isArray(parsed.rules)) {
      return parsed.rules.map((r: ConditionRule) => r.description || JSON.stringify(r));
    }
    if (parsed.description) return [parsed.description];
    return [];
  } catch {
    return [];
  }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [userProgress, setUserProgress] = useState<UserMission | null>(null);
  const [loading, setLoading] = useState(true);
  const loggedIn = isLoggedIn();

  useEffect(() => {
    const load = async () => {
      if (id === "mock-1" || id === "mock-2") {
        setMission({
          id: id,
          title: id === "mock-1" ? "[ทดสอบ] ภารกิจสำเร็จแล้ว" : "[ทดสอบ] ภารกิจรอรับรางวัล",
          description: id === "mock-1" 
            ? "นี่คือตัวอย่างภารกิจที่ทำสำเร็จเรียบร้อยและรับรางวัลแล้ว ในหน้านี้จะแสดงความสำเร็จของคุณ 100%!"
            : "นี่คือตัวอย่างภารกิจที่ทำครบแล้วและกำลังรอให้คุณกดรับรางวัลผ่านหน้าลิสต์หลัก",
          type: "count",
          condition: `[{"description": "สแกน QR Code ครบตามจำนวนที่กำหนด"}]`,
          reward_type: "points",
          reward_points: id === "mock-1" ? 100 : 50,
          reward_currency: "point",
          active: true,
        });

        if (loggedIn) {
          setUserProgress({
            mission_id: id,
            progress: id === "mock-1" ? 5 : 3,
            target: id === "mock-1" ? 5 : 3,
            completed: id === "mock-1" ? true : false,
            completed_at: id === "mock-1" ? new Date().toISOString() : null,
            rewarded: id === "mock-1" ? true : false,
          });
        }
        setLoading(false);
        return;
      }

      try {
        const m = await api.get<Mission>(`/api/v1/public/missions/${id}`);
        setMission(m);

        if (loggedIn) {
          const progressRes = await api.get<{ data?: UserMission[] } | UserMission[]>("/api/v1/my/missions").catch(() => null);
          if (progressRes) {
            const list = Array.isArray(progressRes) ? progressRes : progressRes.data ?? [];
            const match = list.find((p) => p.mission_id === id);
            if (match) setUserProgress(match);
          }
        }
      } catch {
        setMission(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, loggedIn]);

  if (loading) {
    return (
      <div className="pb-24 min-h-screen bg-background">
        <Navbar />
        <div className="pt-24">
          <div className="aspect-video bg-muted animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            <div className="h-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="pb-24 min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 flex flex-col items-center justify-center px-6" style={{ minHeight: "60vh" }}>
          <p className="text-lg font-bold mb-2">ไม่พบภารกิจ</p>
          <p className="text-sm text-muted-foreground mb-6">ภารกิจนี้อาจไม่มีอยู่แล้ว</p>
          <Link href="/missions" className="rounded-full bg-[var(--jh-green)] px-8 py-2.5 text-sm font-bold text-white">
            กลับหน้าภารกิจ
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const imgSrc = mediaUrl(mission.image_url);
  const rules = parseRules(mission.condition);
  const progress = userProgress?.progress ?? 0;
  const target = userProgress?.target ?? mission.reward_points;
  const completed = userProgress?.completed ?? false;
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  const startDate = formatDate(mission.start_date);
  const endDate = formatDate(mission.end_date);

  const typeLabels: Record<string, string> = {
    count: "ภารกิจนับจำนวน",
    streak: "ภารกิจต่อเนื่อง",
    total_points: "ภารกิจสะสมแต้ม",
    custom: "ภารกิจพิเศษ",
  };

  return (
    <div className="pb-36 min-h-screen bg-background">
      <Navbar />

      <div className="pt-[106px]">
        {/* Banner / Header */}
        {imgSrc ? (
          <div className="aspect-square bg-secondary relative overflow-hidden">
            <button
              onClick={() => router.back()}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" className="w-5 h-5">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <Image src={imgSrc} alt={mission.title} fill className="object-cover" sizes="100vw" priority />
          </div>
        ) : (
          <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-12 pb-10 text-white relative overflow-hidden">
            <button
              onClick={() => router.back()}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 animate-float" />
            <div className="absolute left-12 bottom-2 h-16 w-16 rounded-full bg-white/5 animate-float-delay-1" />
            <div className="flex items-center justify-center py-6">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white">
                  <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-5 py-5 space-y-4">
          {/* Title & Type */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold leading-tight flex-1">{mission.title}</h1>
              {completed && <StatusBadge status="completed" size="md" />}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[11px] bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 font-medium">
                {typeLabels[mission.type] || mission.type}
              </span>
              {startDate && endDate && (
                <span className="text-[11px] text-muted-foreground">
                  {startDate} — {endDate}
                </span>
              )}
            </div>
          </div>

          {/* Progress Section */}
          {loggedIn && userProgress && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">ความคืบหน้า</p>
                  <p className="text-sm font-bold text-[var(--jh-green)]">{pct}%</p>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completed
                        ? "bg-[var(--jh-green)]"
                        : "bg-[linear-gradient(90deg,var(--jh-green)_0%,var(--jh-lime)_100%)]"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  {progress} / {target}
                  {completed && " — สำเร็จแล้ว! 🎉"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Reward Card */}
          <Card className="border-0 shadow-sm bg-green-50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">แต้มที่จะได้รับ</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--jh-green)] shadow-sm">
                  {mission.reward_type === "badge" ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--jh-green)]">
                    +{mission.reward_points.toLocaleString()} {mission.reward_currency === "point" ? "แต้ม" : mission.reward_currency}
                  </p>
                  {mission.reward_type === "badge" && (
                    <p className="text-xs text-muted-foreground">+ Badge พิเศษ</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {mission.description && (
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-2">คำอธิบาย</h3>
              <div 
                className="prose prose-sm max-w-none text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap [&>p]:mb-2 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>br]:content-['']"
                dangerouslySetInnerHTML={{ __html: mission.description }}
              />
            </div>
          )}

          {/* Rules Section */}
          {rules.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">กติกาและเงื่อนไข</h3>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <ul className="space-y-2.5">
                    {rules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-[10px] font-bold text-[var(--jh-green)] mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-sm text-muted-foreground leading-relaxed">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-white/95 backdrop-blur-md p-4 app-fixed-bar">
        <div className="max-w-lg mx-auto">
          {!loggedIn ? (
            <Link
              href="/login"
              className="block w-full rounded-full bg-[var(--jh-green)] py-3.5 text-center text-[15px] font-bold text-white"
            >
              เข้าสู่ระบบเพื่อเริ่มภารกิจ
            </Link>
          ) : completed ? (
            <button disabled className="w-full rounded-full bg-green-50 py-3.5 text-[15px] font-bold text-[var(--jh-green)] cursor-default">
              ✓ สำเร็จแล้ว
            </button>
          ) : (
            <Link
              href="/scan"
              className="block w-full rounded-full bg-[var(--jh-green)] py-3.5 text-center text-[15px] font-bold text-white active:scale-[0.98] transition shadow-lg shadow-[var(--jh-green)]/30"
            >
              {userProgress ? "ดำเนินการต่อ" : "เริ่มภารกิจ"}
            </Link>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
