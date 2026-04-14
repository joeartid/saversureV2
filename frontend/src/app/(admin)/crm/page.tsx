"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Segment {
  id: string;
  name: string;
  description?: string | null;
  rules: Record<string, unknown>;
  cached_count: number;
  cached_at?: string | null;
}

interface SegmentPreviewCustomer {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  province?: string | null;
  status: string;
  point_balance: number;
  scan_count_30d: number;
  scan_count_all: number;
  risk_level: string;
  last_scan_at?: string | null;
}

interface RFMDistributionItem {
  risk_level: string;
  count: number;
}

interface RFMSnapshot {
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  province?: string | null;
  status: string;
  last_scan_at?: string | null;
  scan_count_30d: number;
  scan_count_all: number;
  points_earned_all: number;
  points_spent_all: number;
  point_balance: number;
  redeem_count_all: number;
  rfm_score?: string | null;
  risk_level: string;
  refreshed_at: string;
}

interface BroadcastPreviewSummary {
  target_type: string;
  target_value: string;
  target_label: string;
  message_length: number;
  total_matched: number;
  line_linked_count: number;
  estimated_batches: number;
  confirmation_phrase: string;
  risk_level: string;
  requires_extra_ack: boolean;
  warnings: string[];
  sample_recipients: Array<{
    user_id: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    province?: string | null;
    risk_level: string;
    line_masked: string;
  }>;
}

interface BroadcastCampaign {
  id: string;
  name: string;
  message_preview: string;
  target_type: string;
  target_value?: string | null;
  status: string;
  scheduled_at?: string | null;
  total_matched: number;
  line_linked_count: number;
  estimated_batches: number;
  sent_count: number;
  failed_count: number;
  requires_extra_ack: boolean;
  high_risk_ack: boolean;
  started_at?: string | null;
  completed_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

const defaultSegmentRules = JSON.stringify(
  {
    operator: "AND",
    conditions: [
      { field: "scan_count_30d", op: ">=", value: 3 },
      { field: "point_balance", op: ">=", value: 50 },
    ],
  },
  null,
  2,
);

export default function CRMPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [distribution, setDistribution] = useState<RFMDistributionItem[]>([]);
  const [rfmCustomers, setRfmCustomers] = useState<RFMSnapshot[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastCampaign[]>([]);
  const [selectedRisk, setSelectedRisk] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<SegmentPreviewCustomer[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingTag, setSavingTag] = useState(false);
  const [savingSegment, setSavingSegment] = useState(false);
  const [refreshingRFM, setRefreshingRFM] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [broadcastPreview, setBroadcastPreview] = useState<BroadcastPreviewSummary | null>(null);
  const [broadcastPreviewLoading, setBroadcastPreviewLoading] = useState(false);
  const [broadcastSaving, setBroadcastSaving] = useState(false);

  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#6366f1");

  const [segmentName, setSegmentName] = useState("");
  const [segmentDescription, setSegmentDescription] = useState("");
  const [segmentRulesText, setSegmentRulesText] = useState(defaultSegmentRules);
  const [broadcastName, setBroadcastName] = useState("");
  const [broadcastTargetType, setBroadcastTargetType] = useState<"segment" | "tag" | "all">("segment");
  const [broadcastTargetValue, setBroadcastTargetValue] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastScheduledAt, setBroadcastScheduledAt] = useState("");
  const [broadcastConfirmText, setBroadcastConfirmText] = useState("");
  const [broadcastHighRiskAck, setBroadcastHighRiskAck] = useState(false);

  const loadAll = async (riskLevel = selectedRisk) => {
    setLoading(true);
    try {
      const [tagsRes, segmentsRes, distRes, broadcastsRes, customersRes] = await Promise.all([
        api.get<{ data: Tag[] }>("/api/v1/crm/tags"),
        api.get<{ data: Segment[] }>("/api/v1/crm/segments"),
        api.get<{ data: RFMDistributionItem[] }>("/api/v1/crm/rfm/distribution"),
        api.get<{ data: BroadcastCampaign[] }>("/api/v1/crm/broadcasts?limit=20"),
        api.get<{ data: RFMSnapshot[] }>(
          `/api/v1/crm/rfm/customers?limit=20${riskLevel ? `&risk_level=${encodeURIComponent(riskLevel)}` : ""}`,
        ),
      ]);
      setTags(tagsRes.data || []);
      setSegments(segmentsRes.data || []);
      setDistribution(distRes.data || []);
      setBroadcasts(broadcastsRes.data || []);
      setRfmCustomers(customersRes.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "โหลดข้อมูล CRM ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll("");
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadAll(selectedRisk);
    }
  }, [selectedRisk]);

  const totalTaggedSegments = useMemo(
    () => segments.reduce((sum, item) => sum + (item.cached_count || 0), 0),
    [segments],
  );

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      toast.error("กรุณาระบุชื่อ tag");
      return;
    }
    setSavingTag(true);
    try {
      await api.post("/api/v1/crm/tags", { name: tagName.trim(), color: tagColor });
      setTagName("");
      setTagColor("#6366f1");
      await loadAll(selectedRisk);
      toast.success("สร้าง tag แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้าง tag ไม่สำเร็จ");
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (!confirm(`ลบ tag "${tag.name}" ?`)) return;
    try {
      await api.delete(`/api/v1/crm/tags/${tag.id}`);
      await loadAll(selectedRisk);
      toast.success("ลบ tag แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบ tag ไม่สำเร็จ");
    }
  };

  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentName.trim()) {
      toast.error("กรุณาระบุชื่อ segment");
      return;
    }
    let rules: Record<string, unknown>;
    try {
      rules = JSON.parse(segmentRulesText) as Record<string, unknown>;
    } catch {
      toast.error("JSON ของ rules ไม่ถูกต้อง");
      return;
    }
    setSavingSegment(true);
    try {
      await api.post("/api/v1/crm/segments", {
        name: segmentName.trim(),
        description: segmentDescription.trim(),
        rules,
      });
      setSegmentName("");
      setSegmentDescription("");
      setSegmentRulesText(defaultSegmentRules);
      await loadAll(selectedRisk);
      toast.success("สร้าง segment แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้าง segment ไม่สำเร็จ");
    } finally {
      setSavingSegment(false);
    }
  };

  const handleDeleteSegment = async (segment: Segment) => {
    if (!confirm(`ลบ segment "${segment.name}" ?`)) return;
    try {
      await api.delete(`/api/v1/crm/segments/${segment.id}`);
      if (selectedSegmentId === segment.id) {
        setSelectedSegmentId("");
        setPreviewRows([]);
        setPreviewTotal(0);
      }
      await loadAll(selectedRisk);
      toast.success("ลบ segment แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบ segment ไม่สำเร็จ");
    }
  };

  const handlePreviewSegment = async (segmentId: string) => {
    setSelectedSegmentId(segmentId);
    setPreviewLoading(true);
    try {
      const res = await api.get<{ data: SegmentPreviewCustomer[]; total: number }>(
        `/api/v1/crm/segments/${segmentId}/preview?limit=20`,
      );
      setPreviewRows(res.data || []);
      setPreviewTotal(res.total || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "preview segment ไม่สำเร็จ");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRefreshSegment = async (segmentId: string) => {
    try {
      await api.post(`/api/v1/crm/segments/${segmentId}/refresh`, {});
      await loadAll(selectedRisk);
      if (selectedSegmentId === segmentId) {
        await handlePreviewSegment(segmentId);
      }
      toast.success("refresh segment แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "refresh segment ไม่สำเร็จ");
    }
  };

  const handleRefreshRFM = async () => {
    setRefreshingRFM(true);
    try {
      await api.post("/api/v1/crm/rfm/refresh", {});
      await loadAll(selectedRisk);
      if (selectedSegmentId) {
        await handlePreviewSegment(selectedSegmentId);
      }
      toast.success("refresh RFM แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "refresh RFM ไม่สำเร็จ");
    } finally {
      setRefreshingRFM(false);
    }
  };

  const handlePreviewBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast.error("กรุณาระบุข้อความที่จะส่ง");
      return;
    }
    if ((broadcastTargetType === "segment" || broadcastTargetType === "tag") && !broadcastTargetValue) {
      toast.error("กรุณาเลือกกลุ่มเป้าหมาย");
      return;
    }
    setBroadcastPreviewLoading(true);
    setBroadcastConfirmText("");
    setBroadcastHighRiskAck(false);
    try {
      const scheduledAt =
        broadcastScheduledAt.trim() !== ""
          ? new Date(broadcastScheduledAt).toISOString()
          : undefined;
      const res = await api.post<BroadcastPreviewSummary>("/api/v1/crm/broadcasts/preview", {
        target_type: broadcastTargetType,
        target_value: broadcastTargetValue,
        message: broadcastMessage,
        scheduled_at: scheduledAt,
      });
      setBroadcastPreview(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "preview broadcast ไม่สำเร็จ");
    } finally {
      setBroadcastPreviewLoading(false);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastPreview) {
      toast.error("กรุณากด Preview ก่อน");
      return;
    }
    setBroadcastSaving(true);
    try {
      const scheduledAt =
        broadcastScheduledAt.trim() !== ""
          ? new Date(broadcastScheduledAt).toISOString()
          : undefined;
      await api.post("/api/v1/crm/broadcasts", {
        name: broadcastName.trim() || `LINE Broadcast ${new Date().toLocaleString("th-TH")}`,
        target_type: broadcastTargetType,
        target_value: broadcastTargetValue,
        message: broadcastMessage,
        scheduled_at: scheduledAt,
        confirmation_text: broadcastConfirmText,
        high_risk_ack: broadcastHighRiskAck,
      });
      setBroadcastName("");
      setBroadcastTargetType("segment");
      setBroadcastTargetValue("");
      setBroadcastMessage("");
      setBroadcastScheduledAt("");
      setBroadcastConfirmText("");
      setBroadcastHighRiskAck(false);
      setBroadcastPreview(null);
      await loadAll(selectedRisk);
      toast.success("สร้าง broadcast campaign แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้าง broadcast ไม่สำเร็จ");
    } finally {
      setBroadcastSaving(false);
    }
  };

  const riskLevels = ["", "champion", "loyal", "potential", "at_risk", "hibernating", "lost", "normal"];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">CRM</h1>
          <p className="mt-1 text-[14px] text-[var(--md-on-surface-variant)]">
            ใช้ข้อมูลใน V2 local DB เพื่อทำ segmentation, tagging และ RFM โดยไม่เพิ่ม cost ไปที่ V1 AWS
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefreshRFM}
          disabled={refreshingRFM}
          className="h-[40px] px-4 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[13px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-60"
        >
          {refreshingRFM ? "Refreshing..." : "Refresh RFM"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Tags</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">{tags.length}</p>
        </div>
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Segments</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">{segments.length}</p>
        </div>
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Segment Members Cache</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">{totalTaggedSegments.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <p className="text-[12px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">RFM Groups</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--md-primary)]">{distribution.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Customer Tags</h2>
          </div>
          <form onSubmit={handleCreateTag} className="flex flex-wrap gap-3 mb-4">
            <input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="เช่น VIP / New / At Risk"
              className="h-[40px] flex-1 min-w-[220px] px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
            />
            <input
              type="color"
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              className="h-[40px] w-[56px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent"
            />
            <button
              type="submit"
              disabled={savingTag}
              className="h-[40px] px-4 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[13px] font-medium disabled:opacity-60"
            >
              เพิ่ม Tag
            </button>
          </form>
          <div className="space-y-2">
            {loading ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">กำลังโหลด...</p>
            ) : tags.length === 0 ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี tag</p>
            ) : (
              tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between rounded-[12px] border border-[var(--md-outline-variant)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag)}
                    className="text-[12px] text-red-500 hover:underline"
                  >
                    ลบ
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">Create Segment</h2>
          <form onSubmit={handleCreateSegment} className="space-y-3">
            <input
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              placeholder="ชื่อ segment"
              className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
            />
            <input
              value={segmentDescription}
              onChange={(e) => setSegmentDescription(e.target.value)}
              placeholder="คำอธิบาย"
              className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
            />
            <textarea
              value={segmentRulesText}
              onChange={(e) => setSegmentRulesText(e.target.value)}
              className="min-h-[220px] w-full px-4 py-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[12px] font-mono"
            />
            <button
              type="submit"
              disabled={savingSegment}
              className="h-[40px] px-4 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[13px] font-medium disabled:opacity-60"
            >
              สร้าง Segment
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Segments</h2>
          </div>
          <div className="space-y-3">
            {segments.length === 0 ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี segment</p>
            ) : (
              segments.map((segment) => (
                <div key={segment.id} className="rounded-[14px] border border-[var(--md-outline-variant)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-[var(--md-on-surface)]">{segment.name}</p>
                      {segment.description && (
                        <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">{segment.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">cached: {segment.cached_count.toLocaleString()}</span>
                        {segment.cached_at && (
                          <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">
                            updated: {new Date(segment.cached_at).toLocaleString("th-TH")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handlePreviewSegment(segment.id)} className="text-[12px] text-[var(--md-primary)] hover:underline">
                        Preview
                      </button>
                      <button type="button" onClick={() => handleRefreshSegment(segment.id)} className="text-[12px] text-[var(--md-primary)] hover:underline">
                        Refresh
                      </button>
                      <button type="button" onClick={() => handleDeleteSegment(segment)} className="text-[12px] text-red-500 hover:underline">
                        ลบ
                      </button>
                    </div>
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-[12px] bg-[var(--md-surface-container)] p-3 text-[11px] text-[var(--md-on-surface-variant)]">
                    {JSON.stringify(segment.rules, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Segment Preview</h2>
            {selectedSegmentId ? (
              <span className="text-[12px] text-[var(--md-on-surface-variant)]">{previewTotal.toLocaleString()} users</span>
            ) : null}
          </div>
          {previewLoading ? (
            <p className="text-[13px] text-[var(--md-on-surface-variant)]">กำลังโหลด preview...</p>
          ) : !selectedSegmentId ? (
            <p className="text-[13px] text-[var(--md-on-surface-variant)]">เลือก segment ทางซ้ายเพื่อดู preview</p>
          ) : previewRows.length === 0 ? (
            <p className="text-[13px] text-[var(--md-on-surface-variant)]">segment นี้ยังไม่มีสมาชิก</p>
          ) : (
            <div className="space-y-2">
              {previewRows.map((item) => {
                const name =
                  [item.first_name, item.last_name].filter(Boolean).join(" ") ||
                  item.display_name ||
                  item.email ||
                  item.phone ||
                  item.id;
                return (
                  <div key={item.id} className="rounded-[12px] border border-[var(--md-outline-variant)] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[var(--md-on-surface)]">{name}</p>
                        <p className="truncate text-[11px] text-[var(--md-on-surface-variant)]">{item.phone || item.email || "—"}</p>
                      </div>
                      <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5 text-[11px] text-[var(--md-on-surface-variant)]">
                        {item.risk_level}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                      <span>points {item.point_balance.toLocaleString()}</span>
                      <span>30d scans {item.scan_count_30d.toLocaleString()}</span>
                      <span>all scans {item.scan_count_all.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">RFM Distribution</h2>
          </div>
          <div className="space-y-2">
            {distribution.length === 0 ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี snapshot</p>
            ) : (
              distribution.map((item) => (
                <button
                  key={item.risk_level}
                  type="button"
                  onClick={() => setSelectedRisk((prev) => (prev === item.risk_level ? "" : item.risk_level))}
                  className={`flex w-full items-center justify-between rounded-[12px] border px-3 py-2 text-left ${
                    selectedRisk === item.risk_level
                      ? "border-[var(--md-primary)] bg-[var(--md-primary-light)]"
                      : "border-[var(--md-outline-variant)]"
                  }`}
                >
                  <span className="text-[13px] font-medium text-[var(--md-on-surface)]">{item.risk_level}</span>
                  <span className="text-[13px] text-[var(--md-on-surface-variant)]">{item.count.toLocaleString()}</span>
                </button>
              ))
            )}
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setSelectedRisk("")}
              className="text-[12px] text-[var(--md-primary)] hover:underline"
            >
              ล้าง filter
            </button>
          </div>
        </div>

        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1 overflow-x-auto">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">RFM Customers</h2>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="h-[36px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[12px]"
            >
              {riskLevels.map((risk) => (
                <option key={risk || "all"} value={risk}>
                  {risk || "ทั้งหมด"}
                </option>
              ))}
            </select>
          </div>
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--md-outline-variant)]">
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Customer</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Risk</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">30d</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">All</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Balance</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)]">Last Scan</th>
              </tr>
            </thead>
            <tbody>
              {rfmCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[13px] text-[var(--md-on-surface-variant)]">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              ) : (
                rfmCustomers.map((item) => {
                  const name =
                    [item.first_name, item.last_name].filter(Boolean).join(" ") ||
                    item.display_name ||
                    item.email ||
                    item.phone ||
                    item.user_id;
                  return (
                    <tr key={item.user_id} className="border-b border-[var(--md-outline-variant)] last:border-b-0">
                      <td className="px-3 py-2">
                        <div>
                          <p className="text-[13px] font-medium text-[var(--md-on-surface)]">{name}</p>
                          <p className="text-[11px] text-[var(--md-on-surface-variant)]">{item.phone || item.email || "—"}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[var(--md-on-surface)]">{item.risk_level}</td>
                      <td className="px-3 py-2 text-right text-[12px] text-[var(--md-on-surface)]">{item.scan_count_30d.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[12px] text-[var(--md-on-surface)]">{item.scan_count_all.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[12px] font-semibold text-[var(--md-primary)]">{item.point_balance.toLocaleString()}</td>
                      <td className="px-3 py-2 text-[12px] text-[var(--md-on-surface-variant)]">
                        {item.last_scan_at ? new Date(item.last_scan_at).toLocaleString("th-TH") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">LINE Broadcast Composer</h2>
              <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                ต้อง preview ก่อนทุกครั้ง และต้องพิมพ์ confirmation phrase ตามที่ระบบสรุปให้
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateBroadcast} className="space-y-4">
            <input
              value={broadcastName}
              onChange={(e) => setBroadcastName(e.target.value)}
              placeholder="ชื่อ campaign เช่น Winback 30d / แจ้งโปรโมชั่นพิเศษ"
              className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={broadcastTargetType}
                onChange={(e) => {
                  setBroadcastTargetType(e.target.value as "segment" | "tag" | "all");
                  setBroadcastTargetValue("");
                  setBroadcastPreview(null);
                  setBroadcastConfirmText("");
                }}
                className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
              >
                <option value="segment">Segment</option>
                <option value="tag">Tag</option>
                <option value="all">All LINE Users</option>
              </select>

              {broadcastTargetType !== "all" ? (
                <select
                  value={broadcastTargetValue}
                  onChange={(e) => {
                    setBroadcastTargetValue(e.target.value);
                    setBroadcastPreview(null);
                    setBroadcastConfirmText("");
                  }}
                  className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px] md:col-span-2"
                >
                  <option value="">เลือกกลุ่มเป้าหมาย</option>
                  {(broadcastTargetType === "segment" ? segments : tags).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="md:col-span-2 rounded-[var(--md-radius-xl)] border border-amber-300 bg-amber-50 px-4 py-2 text-[12px] text-amber-700">
                  โหมดนี้จะ broadcast ไปยังผู้ใช้ทุกคนที่เชื่อม LINE ใน tenant นี้
                </div>
              )}
            </div>

            <textarea
              value={broadcastMessage}
              onChange={(e) => {
                setBroadcastMessage(e.target.value);
                setBroadcastPreview(null);
              }}
              placeholder="พิมพ์ข้อความที่จะส่งผ่าน LINE"
              className="min-h-[140px] w-full px-4 py-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
            />

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <input
                type="datetime-local"
                value={broadcastScheduledAt}
                onChange={(e) => {
                  setBroadcastScheduledAt(e.target.value);
                  setBroadcastPreview(null);
                  setBroadcastConfirmText("");
                }}
                className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
              />
              <button
                type="button"
                onClick={handlePreviewBroadcast}
                disabled={broadcastPreviewLoading}
                className="h-[40px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium disabled:opacity-60"
              >
                {broadcastPreviewLoading ? "Previewing..." : "Preview Broadcast"}
              </button>
            </div>

            {broadcastPreview && (
              <div className="rounded-[18px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)] p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--md-surface-container)] px-2.5 py-0.5 text-[11px] font-medium">
                    target: {broadcastPreview.target_label || broadcastPreview.target_type}
                  </span>
                  <span className="rounded-full bg-[var(--md-surface-container)] px-2.5 py-0.5 text-[11px] font-medium">
                    matched: {broadcastPreview.total_matched.toLocaleString()}
                  </span>
                  <span className="rounded-full bg-[var(--md-surface-container)] px-2.5 py-0.5 text-[11px] font-medium">
                    line linked: {broadcastPreview.line_linked_count.toLocaleString()}
                  </span>
                  <span className="rounded-full bg-[var(--md-surface-container)] px-2.5 py-0.5 text-[11px] font-medium">
                    batches: {broadcastPreview.estimated_batches.toLocaleString()}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    broadcastPreview.risk_level === "critical"
                      ? "bg-red-100 text-red-700"
                      : broadcastPreview.risk_level === "elevated"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}>
                    risk: {broadcastPreview.risk_level}
                  </span>
                </div>

                {broadcastPreview.warnings.length > 0 && (
                  <div className="rounded-[14px] border border-amber-300 bg-amber-50 p-3">
                    <p className="text-[12px] font-medium text-amber-800">สรุปความเสี่ยงก่อนส่ง</p>
                    <ul className="mt-2 space-y-1 text-[12px] text-amber-700">
                      {broadcastPreview.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>- {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-[12px] font-medium text-[var(--md-on-surface)]">Confirmation Phrase</p>
                  <div className="mt-2 rounded-[14px] border border-[var(--md-outline-variant)] bg-[var(--md-surface)] px-3 py-2 font-mono text-[13px] text-[var(--md-primary)]">
                    {broadcastPreview.confirmation_phrase}
                  </div>
                  <input
                    value={broadcastConfirmText}
                    onChange={(e) => setBroadcastConfirmText(e.target.value)}
                    placeholder="พิมพ์ phrase ด้านบนให้ตรงทุกตัวอักษร"
                    className="mt-2 h-[40px] w-full rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
                  />
                </div>

                {broadcastPreview.requires_extra_ack && (
                  <label className="flex items-start gap-2 text-[12px] text-[var(--md-on-surface-variant)]">
                    <input
                      type="checkbox"
                      checked={broadcastHighRiskAck}
                      onChange={(e) => setBroadcastHighRiskAck(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      ยืนยันว่าผมตรวจสอบแล้วว่าการส่ง LINE ครั้งนี้เป็น high risk campaign, มีผู้รับจำนวนมาก และยอมรับ cost / impact ที่อาจเกิดขึ้น
                    </span>
                  </label>
                )}

                <div>
                  <p className="mb-2 text-[12px] font-medium text-[var(--md-on-surface)]">ตัวอย่างผู้รับ</p>
                  <div className="space-y-2">
                    {broadcastPreview.sample_recipients.map((recipient) => {
                      const name =
                        [recipient.first_name, recipient.last_name].filter(Boolean).join(" ") ||
                        recipient.display_name ||
                        recipient.phone ||
                        recipient.email ||
                        recipient.user_id;
                      return (
                        <div key={recipient.user_id} className="rounded-[12px] border border-[var(--md-outline-variant)] px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-[var(--md-on-surface)]">{name}</p>
                              <p className="truncate text-[11px] text-[var(--md-on-surface-variant)]">
                                {recipient.phone || recipient.email || "—"} | LINE {recipient.line_masked}
                              </p>
                            </div>
                            <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5 text-[11px] text-[var(--md-on-surface-variant)]">
                              {recipient.risk_level}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={broadcastSaving || !broadcastPreview}
                className="h-[40px] px-5 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium disabled:opacity-60"
              >
                {broadcastSaving
                  ? "Saving..."
                  : broadcastScheduledAt
                    ? "Create Scheduled Broadcast"
                    : "Queue Broadcast"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Broadcast History</h2>
          </div>
          <div className="space-y-3">
            {broadcasts.length === 0 ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี broadcast campaign</p>
            ) : (
              broadcasts.map((item) => (
                <div key={item.id} className="rounded-[14px] border border-[var(--md-outline-variant)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-[var(--md-on-surface)]">{item.name}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-[var(--md-on-surface-variant)]">{item.message_preview}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      item.status === "sent"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "failed" || item.status === "partial_failed"
                          ? "bg-red-100 text-red-700"
                          : item.status === "scheduled"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                    <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">{item.target_type}</span>
                    <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">matched {item.total_matched.toLocaleString()}</span>
                    <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">line {item.line_linked_count.toLocaleString()}</span>
                    <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">sent {item.sent_count.toLocaleString()}</span>
                    <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">failed {item.failed_count.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--md-on-surface-variant)]">
                    <div>created: {new Date(item.created_at).toLocaleString("th-TH")}</div>
                    {item.scheduled_at && <div>scheduled: {new Date(item.scheduled_at).toLocaleString("th-TH")}</div>}
                    {item.completed_at && <div>completed: {new Date(item.completed_at).toLocaleString("th-TH")}</div>}
                    {item.last_error && <div className="mt-1 text-red-500">error: {item.last_error}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
