"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface Mission {
  id: string;
  title: string;
  description?: string;
  image_url?: string | null;
  target: number;
  reward_type?: "points" | "badge";
  reward_points?: number;
  reward_badge_id?: string;
  reward_badge_name?: string;
}

interface MissionProgress {
  mission_id: string;
  progress: number;
  completed_at?: string | null;
}

const mediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, MissionProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loggedIn = isLoggedIn();

  useEffect(() => {
    const load = async () => {
      try {
        const [missionsRes, progressRes] = await Promise.all([
          api.get<{ data?: Mission[] } | Mission[]>("/api/v1/public/missions"),
          loggedIn ? api.get<{ data?: MissionProgress[] } | MissionProgress[]>("/api/v1/my/missions").catch(() => null) : null,
        ]);

        const missionsList = Array.isArray(missionsRes) ? missionsRes : missionsRes.data ?? [];
        setMissions(missionsList);

        if (progressRes) {
          const list = Array.isArray(progressRes) ? progressRes : progressRes.data ?? [];
          const map: Record<string, MissionProgress> = {};
          list.forEach((p) => {
            map[p.mission_id] = p;
          });
          setProgressMap(map);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loggedIn]);

  return (
    <div className="pb-20 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        <PageHeader
          title="ภารกิจ"
          subtitle="ทำภารกิจรับคะแนนและ Badge"
          gradient="linear-gradient(135deg, var(--jh-green) 0%, var(--jh-teal) 100%)"
        />

        {!loggedIn && (
          <div className="px-5 -mt-6 relative z-10">
            <div className="bg-white rounded-2xl shadow-md p-4 text-center">
              <p className="text-[14px] text-muted-foreground mb-3">เข้าสู่ระบบเพื่อดูความคืบหน้าภารกิจ</p>
              <Link
                href="/login"
                className="inline-block rounded-full bg-[var(--jh-green)] px-8 py-2.5 text-[14px] font-bold text-white"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        )}

        <div className="px-5 mt-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-muted" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2 mb-3" />
                      <div className="h-2 bg-muted rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
              <p className="text-[14px] font-medium text-red-600">{error}</p>
            </div>
          ) : missions.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
                  <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                </svg>
              }
              title="ยังไม่มีภารกิจ"
              subtitle="ภารกิจใหม่กำลังจะมาเร็วๆ นี้"
            />
          ) : (
            <div className="space-y-3 stagger-children">
              {missions.map((m) => {
                const prog = progressMap[m.id];
                const progress = prog?.progress ?? 0;
                const completed = !!prog?.completed_at;
                const pct = m.target > 0 ? Math.min(100, Math.round((progress / m.target) * 100)) : 0;
                const imgSrc = mediaUrl(m.image_url);

                return (
                  <Link
                    key={m.id}
                    href={`/missions/${m.id}`}
                    className="block bg-white rounded-2xl shadow-sm overflow-hidden card-playful"
                  >
                    <div className="flex gap-4 p-4">
                      <div className="w-20 h-20 shrink-0 rounded-xl bg-secondary overflow-hidden">
                        {imgSrc ? (
                          <img src={imgSrc} alt={m.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="var(--jh-green)" className="w-8 h-8 opacity-40">
                              <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[17px] font-bold truncate text-[var(--md-on-surface)]">{m.title}</h3>
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            {completed && (
                              <span className="w-5 h-5 rounded-full bg-[var(--jh-green)] flex items-center justify-center">
                                <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                              </span>
                            )}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-muted-foreground">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </div>
                        </div>
                        {m.description && (
                          <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                        )}
                        {/* Progress bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[13px] font-medium text-muted-foreground mb-1">
                            <span>{progress} / {m.target}</span>
                            {!completed && <span className="text-[var(--jh-green)]">{pct}%</span>}
                          </div>
                          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${completed ? "bg-[var(--jh-green)]" : "bg-[linear-gradient(90deg,var(--jh-green)_0%,var(--jh-lime)_100%)]"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-[13px] font-semibold">
                          <span className="text-muted-foreground">
                            {m.reward_type === "badge"
                              ? "🏅 ได้รับ Badge"
                              : `🎯 ${m.reward_points ?? 0} คะแนน`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
