"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const badgeColors = [
  { border: "border-[#f44336]", text: "text-[#f44336]", label: "ส่วนลด" },
  { border: "border-[#4caf50]", text: "text-[#4caf50]", label: "แต้มพิเศษ" },
  { border: "border-[#2196f3]", text: "text-[#2196f3]", label: "ลุ้นโชค" },
  { border: "border-[#e91e63]", text: "text-[#e91e63]", label: "BONUS" },
  { border: "border-[#ff9800]", text: "text-[#ff9800]", label: "WATERMELON" }
];

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
  end_date?: string;
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
  const [activeTab, setActiveTab] = useState<'current' | 'completed'>('current');
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

        <div className="px-5 mt-4 mb-4">
          <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-2 text-[14px] font-bold rounded-lg transition-all ${
                activeTab === 'current'
                  ? 'bg-white text-[var(--jh-green)] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              ภารกิจปัจจุบัน
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 text-[14px] font-bold rounded-lg transition-all ${
                activeTab === 'completed'
                  ? 'bg-white text-[var(--jh-green)] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              สำเร็จแล้ว
            </button>
          </div>
        </div>

        <div className="px-5 mt-2">
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
          ) : (() => {
            const displayMissions = missions.filter(m => 
              activeTab === 'current' 
                ? !progressMap[m.id]?.completed_at 
                : !!progressMap[m.id]?.completed_at
            );

            if (displayMissions.length === 0) {
              return (
                <EmptyState
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
                      {activeTab === 'current' ? (
                        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                    </svg>
                  }
                  title={activeTab === 'current' ? "ยังไม่มีภารกิจปัจจุบัน" : "ยังไม่มีภารกิจที่สำเร็จแล้ว"}
                  subtitle={activeTab === 'current' ? "ภารกิจใหม่กำลังจะมาเร็วๆ นี้" : "มาเริ่มทำขุมทรัพย์แรกกันเถอะ"}
                />
              );
            }

            return (
              <div className="space-y-3 stagger-children">
                {displayMissions.map((m, index) => {
                  const prog = progressMap[m.id];
                const progress = prog?.progress ?? 0;
                const completed = !!prog?.completed_at;
                const pct = m.target > 0 ? Math.min(100, Math.round((progress / m.target) * 100)) : 0;
                const imgSrc = mediaUrl(m.image_url);
                const badgeTheme = badgeColors[index % badgeColors.length];
                
                const daysLeft = m.end_date ? Math.ceil((new Date(m.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const timeText = daysLeft !== null ? (daysLeft > 0 ? `เหลืออีก ${daysLeft} วัน` : "หมดเวลา") : "ตลอดปี";

                return (
                  <Link
                    key={m.id}
                    href={`/missions/${m.id}`}
                    className="block bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden mb-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex p-4 gap-3 items-center">
                      <div className="w-[60px] h-[60px] shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 p-0.5">
                        {imgSrc ? (
                          <img src={imgSrc} alt={m.title} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                            <svg viewBox="0 0 24 24" fill="var(--jh-green)" className="w-6 h-6 opacity-30">
                              <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="text-[15px] font-extrabold text-gray-800 truncate tracking-tight">{m.title}</h3>
                        {m.description && (
                          <p className="text-[12px] font-medium text-gray-400 mt-0.5 truncate">{m.description}</p>
                        )}
                        
                        {completed ? (
                          <div className="mt-4 flex items-center text-[#4caf50] font-bold text-[13px] bg-green-50 rounded-lg py-1.5 px-3 w-fit border border-[#4caf50]/20">
                            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            สำเร็จแล้ว
                          </div>
                        ) : (
                          <div className="mt-3.5">
                            <div className="relative h-2.5 bg-gray-100 rounded-full flex items-center mx-1">
                              <div className="absolute left-0 top-0 bottom-0 bg-[#4caf50] rounded-full transition-all duration-700" style={{ width: `${pct}%` }}></div>
                              <div className="absolute left-0 right-0 flex justify-between px-[0px] -mx-1.5">
                                {Array.from({ length: m.target <= 12 ? m.target + 1 : 5 }).map((_, i, arr) => {
                                  const segments = arr.length - 1;
                                  const dotPct = (i / segments) * 100;
                                  const isColored = pct >= dotPct;
                                  const isFarthestColor = isColored && (i === arr.length - 1 || pct < ((i + 1) / segments) * 100);

                                  return (
                                    <div key={i} className={`w-3.5 h-3.5 rounded-full border-[2.5px] flex items-center justify-center z-10 transition-colors duration-500 ${
                                      isFarthestColor && progress > 0 ? 'bg-[#4caf50] border-[#4caf50]' : 
                                      isColored ? 'bg-white border-[#4caf50]' : 
                                      'bg-white border-gray-200'
                                    }`}>
                                      {isFarthestColor && progress > 0 && (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="w-2 h-2"><path d="M5 12l4 4L19 7" /></svg>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-[12px] font-bold mt-2.5 px-0.5">
                              <span className="text-gray-800">{progress}/{m.target}</span>
                              <span className="text-[#f44336] text-[11px] font-bold">{timeText}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={`w-[72px] h-[72px] shrink-0 rounded-full border-[3px] ${badgeTheme.border} bg-white flex flex-col items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] ml-1`}>
                        {m.reward_type === "badge" ? (
                          <>
                            <span className={`font-extrabold text-[13px] leading-tight text-center px-1 ${badgeTheme.text}`}>Badge<br/>ไอเทม</span>
                          </>
                        ) : (
                          <>
                            <span className={`font-black text-[15px] leading-none ${badgeTheme.text}`}>
                              {m.reward_points ?? 0}<span className="text-[10px] ml-0.5">แต้ม</span>
                            </span>
                            <span className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{badgeTheme.label}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
