"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";

interface RFMDistributionPoint {
  risk_level: string;
  count: number;
}

interface CustomerCohortPoint {
  cohort_month: string;
  month_offset: number;
  active_users: number;
  total_users: number;
  retention_rate: number;
}

interface TopProduct {
  product_id: string;
  product_name: string;
  scan_count: number;
  batch_count: number;
  total_codes: number;
}

interface TopReward {
  reward_id: string;
  reward_name: string;
  redeem_count: number;
  points_spent: number;
}

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 วัน" },
  { value: "30d", label: "30 วัน" },
  { value: "90d", label: "90 วัน" },
  { value: "365d", label: "365 วัน" },
  { value: "all", label: "ทั้งหมด" },
];

const PIE_COLORS = ["#1a73e8", "#34a853", "#fbbc04", "#ea4335", "#7e57c2", "#26c6da", "#8d6e63"];

const formatTooltipNumber = (value: number | string | readonly (number | string)[] | undefined) => {
  const scalar = Array.isArray(value) ? value[0] : value;
  return Number(scalar ?? 0).toLocaleString();
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [distribution, setDistribution] = useState<RFMDistributionPoint[]>([]);
  const [cohorts, setCohorts] = useState<CustomerCohortPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topRewards, setTopRewards] = useState<TopReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingCohorts, setRefreshingCohorts] = useState(false);

  const loadAll = async (selectedPeriod = period) => {
    setLoading(true);
    try {
      const [distRes, cohortRes, productRes, rewardRes] = await Promise.all([
        api.get<{ data: RFMDistributionPoint[] }>("/api/v1/dashboard/crm/rfm-distribution"),
        api.get<{ data: CustomerCohortPoint[] }>("/api/v1/dashboard/crm/customer-cohorts"),
        api.get<{ data: TopProduct[] }>(`/api/v1/dashboard/crm/top-products?period=${encodeURIComponent(selectedPeriod)}&limit=10`),
        api.get<{ data: TopReward[] }>(`/api/v1/dashboard/crm/top-rewards?period=${encodeURIComponent(selectedPeriod)}&limit=10`),
      ]);

      setDistribution(distRes.data || []);
      setCohorts(cohortRes.data || []);
      setTopProducts(productRes.data || []);
      setTopRewards(rewardRes.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "โหลด analytics ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll(period);
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadAll(period);
    }
  }, [period]);

  const cohortMonths = useMemo(
    () => Array.from(new Set(cohorts.map((item) => item.cohort_month))).sort().reverse(),
    [cohorts],
  );
  const offsets = useMemo(
    () => Array.from(new Set(cohorts.map((item) => item.month_offset))).sort((a, b) => a - b),
    [cohorts],
  );
  const cohortMap = useMemo(() => {
    const map = new Map<string, CustomerCohortPoint>();
    cohorts.forEach((item) => {
      map.set(`${item.cohort_month}:${item.month_offset}`, item);
    });
    return map;
  }, [cohorts]);

  const totalTrackedCustomers = useMemo(
    () => distribution.reduce((sum, item) => sum + item.count, 0),
    [distribution],
  );

  const handleRefreshCohorts = async () => {
    setRefreshingCohorts(true);
    try {
      await api.post("/api/v1/dashboard/crm/customer-cohorts/refresh", {});
      await loadAll(period);
      toast.success("refresh cohort แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "refresh cohort ไม่สำเร็จ");
    } finally {
      setRefreshingCohorts(false);
    }
  };

  const heatColor = (rate: number) => {
    if (rate >= 60) return "bg-emerald-500/90 text-white";
    if (rate >= 40) return "bg-emerald-400/80 text-white";
    if (rate >= 20) return "bg-amber-300/80 text-amber-950";
    if (rate > 0) return "bg-red-200 text-red-800";
    return "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Customer Analytics</h1>
          <p className="mt-1 text-[14px] text-[var(--md-on-surface-variant)]">
            ใช้ข้อมูล pre-computed จาก V2 local DB เพื่อดูพฤติกรรมลูกค้าและวางแผน campaign ได้เร็วขึ้น
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
          >
            {PERIOD_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleRefreshCohorts}
            disabled={refreshingCohorts}
            className="h-[40px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium disabled:opacity-60"
          >
            {refreshingCohorts ? "Refreshing..." : "Refresh Cohorts"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Tracked Customers</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">{totalTrackedCustomers.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">RFM Groups</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">{distribution.length.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Cohort Months</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">{cohortMonths.length.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Period</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">
            {PERIOD_OPTIONS.find((item) => item.value === period)?.label || period}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">RFM Distribution</h2>
            <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">เห็นสัดส่วน champion / loyal / at risk / lost เพื่อใช้ตัดสินใจ campaign</p>
          </div>
          <div className="h-[320px]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--md-on-surface-variant)]">กำลังโหลด...</div>
            ) : distribution.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มีข้อมูล RFM</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="count"
                    nameKey="risk_level"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={2}
                  >
                    {distribution.map((item, index) => (
                      <Cell key={item.risk_level} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatTooltipNumber(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {distribution.map((item, index) => (
              <div key={item.risk_level} className="inline-flex items-center gap-2 rounded-full bg-[var(--md-surface-container)] px-3 py-1 text-[12px]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                <span>{item.risk_level}</span>
                <span className="text-[var(--md-on-surface-variant)]">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Top Products by Scan</h2>
            <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">รวมทั้งข้อมูลที่มาจาก V2 native และ V1 legacy fallback ที่ sync มาแล้ว</p>
          </div>
          <div className="h-[320px]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--md-on-surface-variant)]">กำลังโหลด...</div>
            ) : topProducts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มีข้อมูลสินค้า</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="product_name" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatTooltipNumber(value)} />
                  <Bar dataKey="scan_count" fill="#1a73e8" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1 overflow-x-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Customer Cohort Retention</h2>
            <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">วัดว่าลูกค้าที่สมัครในเดือนเดียวกันยังกลับมาสแกนต่อในเดือนถัด ๆ ไปมากน้อยแค่ไหน</p>
          </div>
        </div>

        {loading ? (
          <p className="text-[13px] text-[var(--md-on-surface-variant)]">กำลังโหลด...</p>
        ) : cohortMonths.length === 0 ? (
          <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี cohort data</p>
        ) : (
          <table className="w-full min-w-[920px] border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Cohort</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Users</th>
                {offsets.map((offset) => (
                  <th key={offset} className="px-2 py-2 text-center text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">
                    M{offset}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortMonths.map((month) => {
                const totalUsers = cohortMap.get(`${month}:0`)?.total_users ?? 0;
                return (
                  <tr key={month}>
                    <td className="rounded-[12px] bg-[var(--md-surface-container)] px-3 py-2 text-[13px] font-medium text-[var(--md-on-surface)]">
                      {month}
                    </td>
                    <td className="rounded-[12px] bg-[var(--md-surface-container)] px-3 py-2 text-[13px] text-[var(--md-on-surface)]">
                      {totalUsers.toLocaleString()}
                    </td>
                    {offsets.map((offset) => {
                      const point = cohortMap.get(`${month}:${offset}`);
                      const rate = point?.retention_rate ?? 0;
                      return (
                        <td key={`${month}-${offset}`} className={`rounded-[12px] px-2 py-2 text-center text-[12px] font-medium ${heatColor(rate)}`}>
                          <div>{rate.toFixed(0)}%</div>
                          <div className="text-[10px] opacity-80">
                            {(point?.active_users ?? 0).toLocaleString()}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1 overflow-x-auto">
          <div className="mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Top Products Detail</h2>
          </div>
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-[var(--md-outline-variant)]">
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Product</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Scans</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Batches</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Codes</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((item) => (
                <tr key={item.product_id} className="border-b border-[var(--md-outline-variant)] last:border-b-0">
                  <td className="px-3 py-2 text-[13px] text-[var(--md-on-surface)]">{item.product_name}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[var(--md-on-surface)]">{item.scan_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[var(--md-on-surface)]">{item.batch_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[var(--md-on-surface)]">{item.total_codes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1 overflow-x-auto">
          <div className="mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Top Rewards Redeemed</h2>
          </div>
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-[var(--md-outline-variant)]">
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Reward</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Redeems</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Points Spent</th>
              </tr>
            </thead>
            <tbody>
              {topRewards.map((item) => (
                <tr key={item.reward_id} className="border-b border-[var(--md-outline-variant)] last:border-b-0">
                  <td className="px-3 py-2 text-[13px] text-[var(--md-on-surface)]">{item.reward_name}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[var(--md-on-surface)]">{item.redeem_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[12px] font-medium text-[var(--md-primary)]">{item.points_spent.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
