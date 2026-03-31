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
  const [claimedMission, setClaimedMission] = useState<Mission | null>(null);
  const loggedIn = isLoggedIn();

  const handleClaim = async (e: React.MouseEvent, mission: Mission) => {
    e.preventDefault();
    e.stopPropagation();
    
    // ตั้งค่าภารกิจที่ claim ให้ state เพื่อแสดง Modal
    setClaimedMission(mission);
    
    setProgressMap(prev => ({
      ...prev,
      [mission.id]: {
        ...prev[mission.id],
        completed_at: new Date().toISOString()
      }
    }));
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [missionsRes, progressRes] = await Promise.all([
          api.get<{ data?: Mission[] } | Mission[]>("/api/v1/public/missions"),
          loggedIn ? api.get<{ data?: MissionProgress[] } | MissionProgress[]>("/api/v1/my/missions").catch(() => null) : null,
        ]);

        const missionsList = Array.isArray(missionsRes) ? missionsRes : missionsRes.data ?? [];
        
        // --- MOCK TEST DATA ---
        if (!missionsList.find((m: any) => m.id === "mock-1")) {
          missionsList.unshift(
            { id: "mock-1", title: "[ทดสอบ] ภารกิจสำเร็จแล้ว", description: "นี่คือตัวอย่างภารกิจที่ทำสำเร็จเรียบร้อยและรับรางวัลแล้ว", target: 5, reward_points: 100, reward_type: "points" },
            { id: "mock-2", title: "[ทดสอบ] ภารกิจรอรับรางวัล", description: "นี่คือตัวอย่างภารกิจที่ทำครบแล้ว กรุณากดปุ่มเพื่อรับรางวัล", target: 3, reward_points: 50, reward_type: "points" }
          );
        }

        setMissions(missionsList);

        if (progressRes || true) { // Force progress block for mock
          const list = progressRes ? (Array.isArray(progressRes) ? progressRes : progressRes.data ?? []) : [];
          const map: Record<string, MissionProgress> = {};
          list.forEach((p: any) => {
            map[p.mission_id] = p;
          });
          
          // --- MOCK TEST PROGRESS ---
          map["mock-1"] = { mission_id: "mock-1", progress: 5, completed_at: new Date().toISOString() };
          map["mock-2"] = { mission_id: "mock-2", progress: 3, completed_at: null }; // reach target but not completed

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
        {/* Custom Header with very large font and green background matching the theme */}
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-10 text-white relative overflow-hidden">
          {/* Abstract Leaf Graphics Background */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <svg viewBox="0 0 200 200" fill="none" className="absolute top-0 right-0 w-64 h-64 opacity-20">
              <path d="M100 10 C 150 10, 190 50, 190 100 C 190 150, 100 190, 10 100 C 10 50, 50 10, 100 10 Z" fill="#ffffff" />
            </svg>
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 animate-float" />
            <div className="absolute left-10 bottom-2 h-16 w-16 rounded-full bg-white/5 animate-float-delay-1" />
          </div>

          <div className="relative z-10 flex flex-col items-start">
            <h1 className="text-[40px] font-black tracking-tight leading-[1] mb-0 drop-shadow-md">ภารกิจ</h1>
            <p className="text-[17px] font-medium text-white/95 -mt-1.5">ทำภารกิจรับคะแนนและ Badge</p>
          </div>
        </div>

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

        <div className={`px-5 ${!loggedIn ? "mt-4" : "-mt-6 relative z-10"} mb-4`}>
          <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-2xl flex gap-1 shadow-sm border border-gray-100">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-2 text-[14px] font-bold rounded-xl transition-all ${
                activeTab === 'current'
                  ? 'bg-white text-[var(--jh-green)] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              ภารกิจปัจจุบัน
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 text-[14px] font-bold rounded-xl transition-all ${
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
                        ) : progress >= m.target ? (
                          <button 
                            onClick={(e) => handleClaim(e, m)}
                            className="mt-3.5 bg-[var(--jh-orange)] text-white font-bold text-[13px] rounded-full py-1.5 px-5 w-fit shadow-md hover:scale-105 transition-transform flex items-center gap-1.5"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            กดรับรางวัล
                          </button>
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

      {/* Claim Success Popup Modal */}
      {claimedMission && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-[320px] p-6 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-bounce-in relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-32 bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] opacity-10" />
            
            {/* Icon */}
            <div className="relative mx-auto w-24 h-24 mb-4">
              <div className="absolute inset-0 bg-yellow-100 rounded-full animate-pulse-glow" />
              <div className="absolute inset-0 flex items-center justify-center text-6xl animate-wiggle" style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}>
                🎉
              </div>
            </div>
            
            <h2 className="text-[24px] font-black text-gray-800 mb-2 relative z-10">ยินดีด้วย!</h2>
            <p className="text-[15px] text-gray-600 mb-5 relative z-10 leading-snug">
              คุณทำภารกิจ <br/>
              <span className="font-extrabold text-[var(--jh-green)]">{claimedMission.title}</span> <br/>
              สำเร็จแล้ว
            </p>

            <div className="bg-orange-50 rounded-2xl p-4 mb-6 border border-orange-100 relative z-10">
              <div className="text-[13px] text-orange-600 font-bold mb-1">ได้รับรางวัล</div>
              <div className="text-[28px] font-black text-orange-500 leading-none drop-shadow-sm">
                {claimedMission.reward_type === 'points' ? `+${claimedMission.reward_points} แต้ม` : 'Badge ใหม่!'}
              </div>
            </div>

            <button
              onClick={() => setClaimedMission(null)}
              className="w-full bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] text-white font-bold text-[18px] rounded-xl py-3.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md relative z-10"
            >
              ยอดเยี่ยม!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
