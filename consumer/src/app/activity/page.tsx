"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import ActivityTabs from "@/components/ActivityTabs";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { getCurrencyIcon } from "@/lib/currency";

// ---------- Types ----------

interface UserMission {
  id: string;
  mission_id: string;
  progress: number;
  target: number;
  completed: boolean;
  completed_at?: string | null;
  rewarded: boolean;
  mission?: {
    id: string;
    title: string;
    description?: string | null;
    image_url?: string | null;
    reward_type: string;
    reward_points: number;
    reward_currency: string;
  };
}

interface ScanEntry {
  id: string;
  scan_type: string;
  points_earned: number;
  product_name?: string;
  campaign_name?: string;
  bonus_currency?: string;
  bonus_currency_amount?: number;
  created_at: string;
}

interface LuckyDrawCampaign {
  id: string;
  title: string;
  image_url?: string | null;
  status: string;
  draw_date?: string | null;
  total_tickets: number;
}

interface Ticket {
  id: string;
  ticket_number: string;
  created_at: string;
}

// ---------- Helpers ----------

const TABS = [
  { key: "missions", label: "ภารกิจ" },
  { key: "activities", label: "กิจกรรม" },
  { key: "luckydraw", label: "ชิงรางวัล" },
  { key: "bonus", label: "โบนัส" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateGroup(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "วันนี้";
  if (d.toDateString() === yesterday.toDateString()) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

// ---------- Sub-components ----------

function MissionsTab({ missions, loading }: { missions: UserMission[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />;
  if (missions.length === 0) {
    return (
      <EmptyState
        icon={<MissionIcon />}
        title="ยังไม่มีประวัติภารกิจ"
        subtitle="เริ่มทำภารกิจเพื่อรับรางวัลสุดพิเศษ!"
        ctaLabel="ดูภารกิจ"
        ctaHref="/missions"
      />
    );
  }

  return (
    <div className="space-y-2 stagger-children">
      {missions.map((um) => (
        <Link
          key={um.id}
          href={`/missions/${um.mission_id}`}
          className="block bg-white rounded-2xl shadow-sm p-4 card-green-border card-playful"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold truncate">{um.mission?.title || "ภารกิจ"}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">
                  {um.completed && um.completed_at ? formatDate(um.completed_at) : `${um.progress}/${um.target}`}
                </span>
                <span className="text-[11px] text-[var(--jh-green)] font-medium">
                  {um.mission?.reward_type === "badge" ? "🏅 Badge" : `+${um.mission?.reward_points ?? 0} คะแนน`}
                </span>
              </div>
            </div>
            <StatusBadge status={um.completed ? "completed" : "in_progress"} />
          </div>
          {!um.completed && (
            <div className="mt-2">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-[linear-gradient(90deg,var(--jh-green)_0%,var(--jh-lime)_100%)] rounded-full"
                  style={{ width: `${um.target > 0 ? Math.min(100, Math.round((um.progress / um.target) * 100)) : 0}%` }}
                />
              </div>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

function ActivitiesTab({ scans, loading }: { scans: ScanEntry[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />;
  if (scans.length === 0) {
    return (
      <EmptyState
        icon={<ScanIcon />}
        title="ยังไม่มีประวัติกิจกรรม"
        subtitle="เริ่มสแกนสินค้าเพื่อสะสมแต้ม"
        ctaLabel="สแกนเลย"
        ctaHref="/scan"
      />
    );
  }

  // Group by date
  const groups: Record<string, ScanEntry[]> = {};
  scans.forEach((s) => {
    const key = new Date(s.created_at).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([key, items]) => (
        <div key={key}>
          <p className="text-[12px] font-semibold text-muted-foreground mb-2 px-1">{formatDateGroup(items[0].created_at)}</p>
          <div className="space-y-1.5">
            {items.map((s) => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="var(--jh-green)" className="w-4 h-4">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{s.product_name || s.campaign_name || "สแกน"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p className="text-[13px] font-bold text-[var(--jh-green)] shrink-0">+{s.points_earned}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LuckyDrawTab({
  campaigns,
  ticketsMap,
  loading,
}: {
  campaigns: LuckyDrawCampaign[];
  ticketsMap: Record<string, Ticket[]>;
  loading: boolean;
}) {
  if (loading) return <LoadingSkeleton />;

  // Only show campaigns user participated in
  const participated = campaigns.filter((c) => (ticketsMap[c.id]?.length ?? 0) > 0);

  if (participated.length === 0) {
    return (
      <EmptyState
        icon={<LuckyIcon />}
        title="ยังไม่มีประวัติชิงรางวัล"
        subtitle="ลุ้นรางวัลสุดพิเศษจากกิจกรรมของเรา"
        ctaLabel="ดูกิจกรรม"
        ctaHref="/lucky-draw"
      />
    );
  }

  return (
    <div className="space-y-2 stagger-children">
      {participated.map((c) => {
        const tickets = ticketsMap[c.id] || [];
        return (
          <Link
            key={c.id}
            href="/lucky-draw"
            className="block bg-white rounded-2xl shadow-sm p-4 card-green-border card-playful"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold truncate">{c.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-muted-foreground">
                    🎟️ {tickets.length} ตั๋ว
                  </span>
                  {c.draw_date && (
                    <span className="text-[11px] text-muted-foreground">
                      จับรางวัล: {formatDate(c.draw_date)}
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge
                status={c.status === "drawn" ? "completed" : "pending_draw"}
                customLabel={c.status === "drawn" ? "จับแล้ว" : "รอจับรางวัล"}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function BonusTab({ scans, loading }: { scans: ScanEntry[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />;

  const bonusEntries = scans.filter((s) => (s.bonus_currency_amount ?? 0) > 0);

  if (bonusEntries.length === 0) {
    return (
      <EmptyState
        icon={<BonusIcon />}
        title="ยังไม่มีประวัติโบนัส"
        subtitle="สะสมแต้มจากสินค้าที่ร่วมรายการเพื่อรับโบนัส"
        ctaLabel="สแกนเลย"
        ctaHref="/scan"
      />
    );
  }

  return (
    <div className="space-y-2 stagger-children">
      {bonusEntries.map((s) => {
        const icon = getCurrencyIcon(s.bonus_currency);
        return (
          <div key={s.id} className="bg-white rounded-2xl shadow-sm p-4 card-green-border">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold truncate">{s.product_name || s.campaign_name || "โบนัส"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDate(s.created_at)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-bold text-[var(--jh-green)]">
                  +{s.bonus_currency_amount} {icon}
                </p>
                <p className="text-[10px] text-muted-foreground">{s.bonus_currency}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((n) => (
        <div key={n} className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Icons
function MissionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
      <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
    </svg>
  );
}

function LuckyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function BonusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-10 h-10">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ---------- Main Component ----------

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState("missions");
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [luckyDrawCampaigns, setLuckyDrawCampaigns] = useState<LuckyDrawCampaign[]>([]);
  const [ticketsMap, setTicketsMap] = useState<Record<string, Ticket[]>>({});
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [loadingScans, setLoadingScans] = useState(true);
  const [loadingLucky, setLoadingLucky] = useState(true);

  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (!loggedIn) {
      setLoadingMissions(false);
      setLoadingScans(false);
      setLoadingLucky(false);
      return;
    }

    // Load missions
    api.get<{ data?: UserMission[] } | UserMission[]>("/api/v1/my/missions")
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data ?? [];
        setMissions(list);
      })
      .catch(() => {})
      .finally(() => setLoadingMissions(false));

    // Load scans
    api.get<{ data?: ScanEntry[] } | ScanEntry[]>("/api/v1/my/scans?limit=50")
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data ?? [];
        setScans(list);
      })
      .catch(() => {})
      .finally(() => setLoadingScans(false));

    // Load lucky draw campaigns + tickets
    api.get<{ data: LuckyDrawCampaign[] }>("/api/v1/public/lucky-draw")
      .then(async (res) => {
        const campaigns = res.data || [];
        setLuckyDrawCampaigns(campaigns);

        // Load tickets for each campaign (limit to first 10)
        const ticketPromises = campaigns.slice(0, 10).map(async (c) => {
          try {
            const ticketRes = await api.get<{ data: Ticket[] }>(`/api/v1/my/lucky-draw/${c.id}/tickets`);
            return { campaignId: c.id, tickets: ticketRes.data || [] };
          } catch {
            return { campaignId: c.id, tickets: [] };
          }
        });

        const results = await Promise.all(ticketPromises);
        const map: Record<string, Ticket[]> = {};
        results.forEach((r) => { map[r.campaignId] = r.tickets; });
        setTicketsMap(map);
      })
      .catch(() => {})
      .finally(() => setLoadingLucky(false));
  }, [loggedIn]);

  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        <PageHeader
          title="กิจกรรมของฉัน"
          subtitle="ติดตามความคืบหน้าและประวัติกิจกรรม"
        />

        {/* Tab Navigation */}
        <div className="px-4 -mt-6 relative z-10">
          <ActivityTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        <div className="px-4 mt-4">
          {!loggedIn ? (
            <EmptyState
              icon={<MissionIcon />}
              title="กรุณาเข้าสู่ระบบ"
              subtitle="เข้าสู่ระบบเพื่อดูประวัติกิจกรรมของคุณ"
              ctaLabel="เข้าสู่ระบบ"
              ctaHref="/login"
            />
          ) : activeTab === "missions" ? (
            <MissionsTab missions={missions} loading={loadingMissions} />
          ) : activeTab === "activities" ? (
            <ActivitiesTab scans={scans} loading={loadingScans} />
          ) : activeTab === "luckydraw" ? (
            <LuckyDrawTab campaigns={luckyDrawCampaigns} ticketsMap={ticketsMap} loading={loadingLucky} />
          ) : (
            <BonusTab scans={scans} loading={loadingScans} />
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
