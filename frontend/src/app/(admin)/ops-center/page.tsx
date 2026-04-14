"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface LowStock {
  reward_id: string;
  reward_name: string;
  available_qty: number;
  total_qty: number;
}

interface AlertEntry {
  type: string;
  severity: string;
  message: string;
  count?: number;
}

interface RollOverview {
  pending_print: number;
  printed: number;
  mapped: number;
  qc_approved: number;
  qc_rejected: number;
  distributed: number;
  recalled: number;
  total: number;
}

interface DigestSummary {
  tenant_id: string;
  date: string;
  total_scans_today: number;
  unique_users_today: number;
  points_awarded_today: number;
  pending_redemptions: number;
  expired_reservations: number;
  pending_fulfillment: number;
  qc_fails_today: number;
  recalled_rolls: number;
  unmapped_rolls: number;
  low_stock_rewards: LowStock[] | null;
  alerts: AlertEntry[] | null;
  roll_stats: RollOverview;
  new_users_today: number;
  redeem_count_today: number;
}

interface SyncEntityStatus {
  entity: string;
  last_synced_id: number;
  last_run_at?: string | null;
  status: string;
  rows_synced: number;
  total_synced: number;
  error_message?: string | null;
}

interface HealthMetric {
  key: string;
  label: string;
  value: number;
}

interface HealthIssue {
  key: string;
  label: string;
  severity: string;
  count: number;
  note?: string;
}

interface FlowHealth {
  name: string;
  status: string;
  summary: string;
  metrics: HealthMetric[];
  issues: HealthIssue[];
}

interface V1SyncHealth {
  checked_at: string;
  tenant_id: string;
  configured: boolean;
  sync_enabled: boolean;
  running: boolean;
  overall: string;
  source: {
    connected: boolean;
    user_max_id: number;
    scan_max_id: number;
    redeem_max_id: number;
    error?: string;
  };
  entities: SyncEntityStatus[];
  flows: FlowHealth[];
}

const severityColor: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  critical: { bg: "#fce8e6", text: "#c5221f", border: "#c5221f", icon: "!" },
  warning:  { bg: "#fef7e0", text: "#e37400", border: "#e37400", icon: "⚠" },
  info:     { bg: "#e8f0fe", text: "#1a73e8", border: "#1a73e8", icon: "ℹ" },
};

const healthStatusStyle: Record<string, { bg: string; text: string }> = {
  healthy: { bg: "#e6f4ea", text: "#188038" },
  warning: { bg: "#fef7e0", text: "#e37400" },
  critical: { bg: "#fce8e6", text: "#c5221f" },
};

export default function OpsCenterPage() {
  const [digest, setDigest] = useState<DigestSummary | null>(null);
  const [health, setHealth] = useState<V1SyncHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState("");
  const [healthError, setHealthError] = useState("");
  const [syncAction, setSyncAction] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");

  const fetchHealth = async (refresh = false) => {
    setHealthLoading(true);
    setHealthError("");
    try {
      const healthResult = await api.get<V1SyncHealth>(`/api/v1/v1-sync/health${refresh ? "?refresh=1" : ""}`);
      setHealth(healthResult);
    } catch (e: unknown) {
      setHealth(null);
      setHealthError(e instanceof Error ? e.message : "Failed to load V1 sync health");
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchDigest = async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const digestResult = await api.get<DigestSummary>(`/api/v1/ops/digest${refresh ? "?refresh=1" : ""}`);
      setDigest(digestResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load ops digest");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDigest();
    void fetchHealth();
  }, []);

  const triggerSync = async (entities: string[], label: string) => {
    setSyncAction(label);
    setSyncMessage("");
    try {
      const res = await api.post<{ results?: Array<{ entity: string; rows_synced: number; error?: string }> }>(
        "/api/v1/v1-sync/trigger",
        { entities, limit: 5000 }
      );
      const results = res.results || [];
      const hasError = results.some((item) => item.error);
      const summary = results
        .map((item) => `${item.entity}: ${item.error ? `error` : `+${item.rows_synced}`}`)
        .join(" · ");
      setSyncMessage(hasError ? `Sync finished with warnings — ${summary}` : `Sync completed — ${summary}`);
      await Promise.all([fetchDigest(true), fetchHealth(true)]);
    } catch (e: unknown) {
      setSyncMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncAction(null);
    }
  };

  const todayCards = digest
    ? [
        { label: "Scans Today", value: digest.total_scans_today, sub: `${digest.unique_users_today} unique users`, color: "#1a73e8", bg: "#e8f0fe" },
        { label: "Points Awarded", value: digest.points_awarded_today, sub: "today", color: "#188038", bg: "#e6f4ea" },
        { label: "Redeems Today", value: digest.redeem_count_today, sub: `${digest.pending_fulfillment} pending ship`, color: "#e37400", bg: "#fef7e0" },
        { label: "New Users", value: digest.new_users_today, sub: "registered today", color: "#7b1fa2", bg: "#f3e5f5" },
      ]
    : [];

  const rollPipeline = digest
    ? [
        { label: "Pending Print", value: digest.roll_stats.pending_print, color: "#5f6368" },
        { label: "Printed", value: digest.roll_stats.printed, color: "#1a73e8" },
        { label: "Mapped", value: digest.roll_stats.mapped, color: "#7b1fa2" },
        { label: "QC Approved", value: digest.roll_stats.qc_approved, color: "#188038" },
        { label: "QC Rejected", value: digest.roll_stats.qc_rejected, color: "#c5221f" },
        { label: "Distributed", value: digest.roll_stats.distributed, color: "#00695c" },
        { label: "Recalled", value: digest.roll_stats.recalled, color: "#b71c1c" },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-3 border-[var(--md-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#fce8e6] rounded-[var(--md-radius-lg)] p-6 text-center">
        <p className="text-[#c5221f] text-[14px]">{error}</p>
        <button onClick={() => { void fetchDigest(true); }} className="mt-3 text-[13px] text-[#1a73e8] hover:underline">
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!digest) return null;

  const alerts = digest.alerts || [];
  const criticals = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos = alerts.filter((a) => a.severity === "info");
  const healthStyle = healthStatusStyle[health?.overall || "healthy"] || healthStatusStyle.healthy;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Ops Center
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            สรุปสถานะระบบประจำวัน — {digest.date}
          </p>
        </div>
        <button
          onClick={() => {
            void fetchDigest(true);
            void fetchHealth(true);
          }}
          className="h-[40px] px-5 border border-[var(--md-outline-variant)] text-[var(--md-on-surface)] rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-surface-dim)] transition-all flex items-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {[...criticals, ...warnings, ...infos].map((alert, i) => {
            const style = severityColor[alert.severity] || severityColor.info;
            return (
              <div
                key={`${alert.type}-${i}`}
                className="flex items-center gap-3 p-3 rounded-[var(--md-radius-md)] border"
                style={{ backgroundColor: style.bg, borderColor: style.border + "40" }}
              >
                <span className="text-[16px] flex-shrink-0" style={{ color: style.text }}>
                  {style.icon}
                </span>
                <p className="text-[13px] flex-1" style={{ color: style.text }}>
                  {alert.message}
                </p>
                {alert.severity === "critical" && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: style.text, color: "#fff" }}
                  >
                    CRITICAL
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* V1 Sync Health */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)]">V1 Sync Health</h2>
            <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">
              ตรวจ flow สำคัญของ `customer`, `scan`, `redeem`, `point_ledger`
            </p>
          {health && (
            <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">
              checked at {health.checked_at}
            </p>
          )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => triggerSync(["user", "scan_history", "redeem_history"], "all")}
            disabled={syncAction !== null}
            className="h-[36px] px-4 rounded-[var(--md-radius-xl)] text-[12px] font-medium bg-[var(--md-primary)] text-white disabled:opacity-50"
          >
            {syncAction === "all" ? "Syncing..." : "Sync All Now"}
          </button>
          <button
            type="button"
            onClick={() => triggerSync(["redeem_history"], "redeem")}
            disabled={syncAction !== null}
            className="h-[36px] px-4 rounded-[var(--md-radius-xl)] text-[12px] font-medium border border-[var(--md-outline-variant)] text-[var(--md-on-surface)] disabled:opacity-50"
          >
            {syncAction === "redeem" ? "Syncing..." : "Sync Redeem Now"}
          </button>
          {healthLoading ? (
            <div className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#e8f0fe] text-[#1a73e8]">
              loading...
            </div>
          ) : health ? (
            <div
              className="px-3 py-1 rounded-full text-[12px] font-semibold"
              style={{ backgroundColor: healthStyle.bg, color: healthStyle.text }}
            >
              {health.overall}
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#fef7e0] text-[#e37400]">
              unavailable
            </div>
          )}
          </div>
        </div>

        {healthError && (
          <div className="mb-4 rounded-[var(--md-radius-md)] border border-[#fce8e6] bg-[#fce8e6] px-4 py-3 text-[12px] text-[#c5221f]">
            {healthError}
          </div>
        )}

        {syncMessage && (
          <div className="mb-4 rounded-[var(--md-radius-md)] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container)] px-4 py-3 text-[12px] text-[var(--md-on-surface)]">
            {syncMessage}
          </div>
        )}

        {healthLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)] h-[160px] animate-pulse" />
            ))}
          </div>
        ) : health && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <div className="rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)] p-4">
                <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">Source</p>
                <p className="mt-1 text-[18px] font-medium" style={{ color: health.source.connected ? "#188038" : "#c5221f" }}>
                  {health.source.connected ? "Connected" : "Disconnected"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                  user max {health.source.user_max_id.toLocaleString()} · scan max {health.source.scan_max_id.toLocaleString()} · redeem max {health.source.redeem_max_id.toLocaleString()}
                </p>
              </div>
              <div className="rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)] p-4">
                <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">Scheduler</p>
                <p className="mt-1 text-[18px] font-medium text-[var(--md-on-surface)]">
                  {health.sync_enabled ? "Enabled" : "Disabled"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                  running: {health.running ? "yes" : "no"}
                </p>
              </div>
              {health.entities.map((entity) => {
                const style = healthStatusStyle[entity.status] || healthStatusStyle.warning;
                return (
                  <div key={entity.entity} className="rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)] p-4">
                    <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">{entity.entity}</p>
                    <p className="mt-1 text-[18px] font-medium" style={{ color: style.text }}>{entity.status}</p>
                    <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                      watermark {entity.last_synced_id.toLocaleString()} · rows {entity.rows_synced.toLocaleString()}
                    </p>
                    {entity.last_run_at && (
                      <p className="mt-1 text-[11px] text-[var(--md-on-surface-variant)]">
                        last run {entity.last_run_at}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {health.flows.map((flow) => {
                const style = healthStatusStyle[flow.status] || healthStatusStyle.warning;
                return (
                  <div key={flow.name} className="rounded-[var(--md-radius-md)] border border-[var(--md-outline-variant)] p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-[15px] font-medium text-[var(--md-on-surface)]">{flow.name}</h3>
                        <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">{flow.summary}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: style.bg, color: style.text }}>
                        {flow.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {flow.metrics.map((metric) => (
                        <div key={metric.key} className="rounded-[10px] bg-[var(--md-surface-container)] px-3 py-2">
                          <p className="text-[11px] text-[var(--md-on-surface-variant)]">{metric.label}</p>
                          <p className="mt-1 text-[16px] font-medium text-[var(--md-on-surface)]">
                            {(metric.value ?? 0).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>

                    {flow.issues.length > 0 ? (
                      <div className="space-y-2">
                        {flow.issues.map((issue) => {
                          const issueStyle = severityColor[issue.severity] || severityColor.info;
                          return (
                            <div
                              key={issue.key}
                              className="rounded-[10px] border px-3 py-2"
                              style={{ backgroundColor: issueStyle.bg, borderColor: issueStyle.border + "33" }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[12px] font-medium" style={{ color: issueStyle.text }}>
                                  {issue.label}
                                </p>
                                <span className="text-[12px] font-semibold" style={{ color: issueStyle.text }}>
                                  {issue.count.toLocaleString()}
                                </span>
                              </div>
                              {issue.note && (
                                <p className="mt-1 text-[11px]" style={{ color: issueStyle.text }}>
                                  {issue.note}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-[10px] bg-[#e6f4ea] px-3 py-2 text-[12px] text-[#188038]">
                        ยังไม่พบ issue ใน flow นี้
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {todayCards.map((card) => (
          <div
            key={card.label}
            className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1"
          >
            <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px]">
              {card.label}
            </p>
            <p className="text-[28px] font-medium mt-1 leading-none" style={{ color: card.color }}>
              {(card.value ?? 0).toLocaleString()}
            </p>
            <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-2">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Roll Pipeline + Fulfillment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Roll Pipeline */}
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)]">Roll Pipeline</h2>
            <span className="text-[12px] text-[var(--md-on-surface-variant)]">
              Total: {digest.roll_stats.total}
            </span>
          </div>
          <div className="space-y-3">
            {rollPipeline.map((stage) => {
              const pct = digest.roll_stats.total > 0 ? (stage.value / digest.roll_stats.total) * 100 : 0;
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-[var(--md-on-surface)]">{stage.label}</span>
                    <span className="text-[13px] font-medium" style={{ color: stage.color }}>
                      {stage.value}
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--md-surface-container)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fulfillment & Redemption Status */}
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
          <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4">
            Fulfillment Status
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#fef7e0] flex items-center justify-center text-[#e37400]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <span className="text-[14px] text-[var(--md-on-surface)]">Pending Fulfillment</span>
              </div>
              <span className="text-[20px] font-medium text-[#e37400]">{digest.pending_fulfillment}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                  </svg>
                </div>
                <span className="text-[14px] text-[var(--md-on-surface)]">Pending Reservations</span>
              </div>
              <span className="text-[20px] font-medium text-[#1a73e8]">{digest.pending_redemptions}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#fce8e6] flex items-center justify-center text-[#c5221f]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                </div>
                <span className="text-[14px] text-[var(--md-on-surface)]">Expired Reservations</span>
              </div>
              <span className="text-[20px] font-medium text-[#c5221f]">{digest.expired_reservations}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Rewards */}
      {(digest.low_stock_rewards?.length ?? 0) > 0 && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
          <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4">
            Low Stock Rewards
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[var(--md-on-surface-variant)] text-left border-b border-[var(--md-outline-variant)]">
                  <th className="pb-2 font-medium">Reward</th>
                  <th className="pb-2 font-medium text-right">Available</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {digest.low_stock_rewards!.map((ls) => (
                  <tr key={ls.reward_id} className="border-b border-[var(--md-outline-variant)] last:border-0">
                    <td className="py-3 text-[var(--md-on-surface)]">{ls.reward_name}</td>
                    <td className="py-3 text-right font-mono font-medium" style={{ color: ls.available_qty === 0 ? "#c5221f" : "#e37400" }}>
                      {ls.available_qty}
                    </td>
                    <td className="py-3 text-right text-[var(--md-on-surface-variant)]">{ls.total_qty}</td>
                    <td className="py-3 text-right">
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: ls.available_qty === 0 ? "#fce8e6" : "#fef7e0",
                          color: ls.available_qty === 0 ? "#c5221f" : "#e37400",
                        }}
                      >
                        {ls.available_qty === 0 ? "OUT OF STOCK" : "LOW STOCK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
        <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { href: "/fulfillment", label: "Fulfillment Management", color: "#e37400", bg: "#fef7e0" },
            { href: "/rolls", label: "Roll Management", color: "#1a73e8", bg: "#e8f0fe" },
            { href: "/transactions", label: "Transactions", color: "#188038", bg: "#e6f4ea" },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-4 rounded-[var(--md-radius-md)] border border-[var(--md-outline-variant)] hover:border-[var(--md-outline)] hover:bg-[var(--md-surface-dim)] transition-all"
            >
              <div
                className="w-10 h-10 rounded-[var(--md-radius-sm)] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: action.bg, color: action.color }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
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
