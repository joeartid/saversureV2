"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Summary {
  campaigns: number;
  campaign_stats: Record<string, number>;
  batches: number;
  total_codes: number;
  rewards: number;
  scans_today: number;
  scans_7d: number;
  scans_30d: number;
  points_issued: number;
  points_redeemed: number;
  users_total: number;
}

interface ScanChartPoint {
  label: string;
  count: number;
}

interface FunnelData {
  total_generated: number;
  total_scanned: number;
  total_redeemed: number;
  scan_rate?: number;
  redeem_rate?: number;
}

interface ActivityItem {
  id: string;
  type: "scan" | "redeem";
  user_id?: string;
  user_email?: string;
  campaign_id?: string;
  reward_name?: string;
  points?: number;
  created_at: string;
}

const defaultSummary: Summary = {
  campaigns: 0, campaign_stats: {}, batches: 0, total_codes: 0,
  rewards: 0, scans_today: 0, scans_7d: 0, scans_30d: 0,
  points_issued: 0, points_redeemed: 0, users_total: 0,
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [chartData, setChartData] = useState<ScanChartPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartGroup, setChartGroup] = useState("day");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sum, chart, funnelRes, activityRes] = await Promise.all([
          api.get<Summary>("/api/v1/dashboard/summary"),
          api.get<{ data: ScanChartPoint[] }>("/api/v1/dashboard/scan-chart?group_by=day"),
          api.get<FunnelData>("/api/v1/dashboard/funnel").catch(() => null),
          api.get<{ data: ActivityItem[] }>("/api/v1/dashboard/recent-activity?limit=10").catch(() => ({ data: [] })),
        ]);
        if (sum && typeof sum.campaigns === "number") setSummary(sum);
        if (chart?.data) setChartData(chart.data);
        if (funnelRes) setFunnel(funnelRes);
        if (activityRes?.data) setActivity(activityRes.data);
      } catch {
        // API might not be ready
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.download("/api/v1/redeem-transactions/export", "transactions.csv");
    } catch {
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const fetchChart = async (group: string) => {
    setChartGroup(group);
    try {
      const chart = await api.get<{ data: ScanChartPoint[] }>(
        `/api/v1/dashboard/scan-chart?group_by=${group}`
      );
      if (chart?.data) setChartData(chart.data);
    } catch {
      // ignore
    }
  };

  const statCards = [
    {
      label: "Campaigns",
      value: summary.campaigns,
      sub: `${summary.campaign_stats?.active || 0} active`,
      color: "#1a73e8",
      bgColor: "#e8f0fe",
      icon: <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 3V6L5 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />,
    },
    {
      label: "Batches",
      value: summary.batches,
      sub: `${summary.total_codes.toLocaleString()} codes`,
      color: "#188038",
      bgColor: "#e6f4ea",
      icon: <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />,
    },
    {
      label: "Scans Today",
      value: summary.scans_today,
      sub: `${summary.scans_7d.toLocaleString()} in 7d`,
      color: "#7b1fa2",
      bgColor: "#f3e5f5",
      icon: <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM22 7h-2V4h-3V2h5v5zm0 15v-5h-2v3h-3v2h5zM2 22h5v-2H4v-3H2v5zM2 2v5h2V4h3V2H2z" />,
    },
    {
      label: "Rewards",
      value: summary.rewards,
      sub: `${summary.points_issued.toLocaleString()} pts issued`,
      color: "#e37400",
      bgColor: "#fef7e0",
      icon: <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68A2.99 2.99 0 009 2C7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />,
    },
    {
      label: "Users",
      value: summary.users_total,
      sub: `${summary.points_redeemed.toLocaleString()} pts redeemed`,
      color: "#c62828",
      bgColor: "#ffebee",
      icon: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
    },
    {
      label: "Scans 30d",
      value: summary.scans_30d,
      sub: "last 30 days",
      color: "#00695c",
      bgColor: "#e0f2f1",
      icon: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />,
    },
  ];

  const Skeleton = () => (
    <span className="inline-block w-14 h-8 bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] animate-pulse" />
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Dashboard
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            QR Code Management System Overview
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {exporting ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
          )}
          Export Transactions
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1 hover:md-elevation-2 transition-shadow duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                  {card.label}
                </p>
                <p className="text-[32px] font-medium text-[var(--md-on-surface)] mt-1 leading-none tracking-[-0.5px]">
                  {loading ? <Skeleton /> : (card.value ?? 0).toLocaleString()}
                </p>
                <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-2">
                  {card.sub}
                </p>
              </div>
              <div
                className="w-11 h-11 rounded-[var(--md-radius-md)] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: card.bgColor, color: card.color }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]">
                  {card.icon}
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scan trend chart */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] tracking-[0.1px]">
              Scan Trend
            </h2>
            <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">
              QR code scans over time
            </p>
          </div>
          <div className="flex gap-1 bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] p-1">
            {(["day", "week", "month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => fetchChart(g)}
                className={`
                  h-[30px] px-3 text-[12px] font-medium rounded-[6px] transition-all duration-200
                  ${chartGroup === g
                    ? "bg-[var(--md-surface)] text-[var(--md-primary)] md-elevation-1"
                    : "text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
                  }
                `}
              >
                {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1a73e8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#5f6368" }}
                  axisLine={{ stroke: "#e8eaed" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#5f6368" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e8eaed",
                    borderRadius: "12px",
                    fontSize: "13px",
                    boxShadow: "0 2px 6px rgba(60,64,67,.15)",
                  }}
                  labelStyle={{ color: "#202124", fontWeight: 500 }}
                  itemStyle={{ color: "#1a73e8" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Scans"
                  stroke="#1a73e8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorScans)"
                  dot={false}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--md-on-surface-variant)]">
              <div className="text-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                </svg>
                <p className="text-[14px]">No scan data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversion Funnel */}
      {funnel && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-8">
          <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
            Conversion Funnel
          </h2>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 rounded-[var(--md-radius-md)] bg-[#e8f0fe] p-4 text-center border border-[#1a73e8]/30">
              <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase">Generated</p>
              <p className="text-[24px] font-bold text-[#1a73e8] mt-1">{(funnel.total_generated ?? 0).toLocaleString()}</p>
            </div>
            <div className="flex items-center">
              <span className="text-[12px] text-[var(--md-on-surface-variant)]">
                {funnel.scan_rate != null ? `${funnel.scan_rate.toFixed(1)}%` : "→"}
              </span>
            </div>
            <div className="flex-1 min-w-0 rounded-[var(--md-radius-md)] bg-[#e6f4ea] p-4 text-center border border-[#188038]/30">
              <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase">Scanned</p>
              <p className="text-[24px] font-bold text-[#188038] mt-1">{(funnel.total_scanned ?? 0).toLocaleString()}</p>
            </div>
            <div className="flex items-center">
              <span className="text-[12px] text-[var(--md-on-surface-variant)]">
                {funnel.redeem_rate != null ? `${funnel.redeem_rate.toFixed(1)}%` : "→"}
              </span>
            </div>
            <div className="flex-1 min-w-0 rounded-[var(--md-radius-md)] bg-[#fef7e0] p-4 text-center border border-[#e37400]/30">
              <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase">Redeemed</p>
              <p className="text-[24px] font-bold text-[#e37400] mt-1">{(funnel.total_redeemed ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Feed */}
      {activity.length > 0 && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-8">
          <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4 tracking-[0.1px]">
            Recent Activity
          </h2>
          <div className="space-y-0">
            {activity.map((item, index) => (
              <div
                key={item.id || `activity-${index}`}
                className="flex items-start gap-4 py-3 border-b border-[var(--md-outline-variant)] last:border-b-0"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === "scan" ? "bg-[#e8f0fe] text-[#1a73e8]" : "bg-[#fef7e0] text-[#e37400]"
                  }`}
                >
                  {item.type === "scan" ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68A2.99 2.99 0 009 2C7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--md-on-surface)]">
                    {item.type === "scan" ? (
                      <>Scan by {item.user_email || "User"} {item.campaign_id && `(Campaign: ${item.campaign_id})`}</>
                    ) : (
                      <>Redeem: {item.reward_name || "Reward"} {item.points != null && `(${item.points} pts)`}</>
                    )}
                  </p>
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
        <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4 tracking-[0.1px]">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { href: "/campaigns", label: "Create Campaign", color: "#1a73e8", bg: "#e8f0fe",
              icon: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /> },
            { href: "/batches", label: "Generate Batch", color: "#188038", bg: "#e6f4ea",
              icon: <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" /> },
            { href: "/rewards", label: "Add Reward", color: "#e37400", bg: "#fef7e0",
              icon: <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68A2.99 2.99 0 009 2C7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" /> },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-4 rounded-[var(--md-radius-md)] border border-[var(--md-outline-variant)] hover:border-[var(--md-outline)] hover:bg-[var(--md-surface-dim)] transition-all duration-200"
            >
              <div
                className="w-10 h-10 rounded-[var(--md-radius-sm)] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: action.bg, color: action.color }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">{action.icon}</svg>
              </div>
              <span className="text-[14px] font-medium text-[var(--md-on-surface)]">{action.label}</span>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-auto text-[var(--md-on-surface-variant)]">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
