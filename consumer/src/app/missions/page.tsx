"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
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
    <div className="pb-20">
      <div className="bg-gradient-to-br from-[var(--primary)] to-[#1557b0] text-white px-5 pt-12 pb-6 rounded-b-[24px]">
        <h1 className="text-[22px] font-semibold">ภารกิจ</h1>
        <p className="text-[13px] opacity-80 mt-1">ทำภารกิจรับคะแนนและ Badge</p>
      </div>

      {!loggedIn && (
        <div className="px-5 mt-4">
          <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4 text-center">
            <p className="text-[14px] text-[var(--on-surface-variant)] mb-3">เข้าสู่ระบบเพื่อดูความคืบหน้าภารกิจ</p>
            <Link
              href="/login"
              className="inline-block h-[44px] px-8 leading-[44px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[14px] font-medium"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      )}

      <div className="px-5 mt-6">
        {loading ? (
          <div className="text-center py-12">
            <svg className="animate-spin w-8 h-8 mx-auto text-[var(--primary)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="bg-[var(--error-light)] border border-[var(--error)] rounded-[var(--radius-lg)] p-4 text-center">
            <p className="text-[14px] font-medium text-[var(--error)]">{error}</p>
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-12 text-[var(--on-surface-variant)]">
            <p className="text-[14px]">ยังไม่มีภารกิจ</p>
          </div>
        ) : (
          <div className="space-y-4">
            {missions.map((m) => {
              const prog = progressMap[m.id];
              const progress = prog?.progress ?? 0;
              const completed = !!prog?.completed_at;
              const pct = m.target > 0 ? Math.min(100, Math.round((progress / m.target) * 100)) : 0;

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-[var(--radius-lg)] elevation-1 overflow-hidden"
                >
                  <div className="flex gap-4 p-4">
                    <div className="w-20 h-20 shrink-0 rounded-[var(--radius-md)] bg-[var(--surface-container)] overflow-hidden">
                      {m.image_url ? (
                        <img src={m.image_url} alt={m.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="var(--primary)" className="w-10 h-10 opacity-40">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[15px] font-semibold text-[var(--on-surface)]">{m.title}</h3>
                        {completed && (
                          <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-[13px] text-[var(--on-surface-variant)] mt-0.5 line-clamp-2">{m.description}</p>
                      )}
                      <div className="mt-2">
                        <div className="flex justify-between text-[12px] text-[var(--on-surface-variant)] mb-1">
                          <span>{progress} / {m.target}</span>
                          {!completed && <span>{pct}%</span>}
                        </div>
                        <div className="h-2 bg-[var(--surface-container)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--primary)] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-[12px]">
                        {completed ? (
                          <span className="text-[var(--success)] font-medium">
                            {m.reward_type === "badge" ? "🏅 ได้รับ Badge" : `🎯 ได้รับ ${m.reward_points ?? 0} คะแนน`}
                          </span>
                        ) : (
                          <span className="text-[var(--on-surface-variant)]">
                            {m.reward_type === "badge"
                              ? "🏅 ได้รับ Badge"
                              : `🎯 ${m.reward_points ?? 0} คะแนน`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
