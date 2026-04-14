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

interface CRMTrigger {
  id: string;
  name: string;
  event_type: string;
  delay_hours: number;
  action_type: string;
  action_payload: Record<string, unknown>;
  active: boolean;
  fired_count: number;
  last_fired_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface AutomationRunSummary {
  point_expiry: {
    processed_entries: number;
    expired_points: number;
    notified_users: number;
  };
  triggers: {
    processed_triggers: number;
    sent: number;
    skipped: number;
    failed: number;
  };
}

interface Survey {
  id: string;
  title: string;
  questions: unknown[];
  trigger_event?: string | null;
  active: boolean;
  response_count: number;
  average_rating?: number | null;
  created_at: string;
  updated_at: string;
}

interface ReferralCode {
  id: string;
  user_id: string;
  user_name?: string | null;
  code: string;
  uses: number;
  max_uses?: number | null;
  reward_referrer: number;
  reward_referee: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ReferralHistoryItem {
  id: string;
  referral_code: string;
  referrer_id: string;
  referrer_name?: string | null;
  referee_id: string;
  referee_name?: string | null;
  points_given: number;
  created_at: string;
}

interface SegmentExportJob {
  id: string;
  segment_id: string;
  segment_name: string;
  status: string;
  total_rows: number;
  object_key?: string | null;
  file_url?: string | null;
  requested_by?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

interface SurveyInsights {
  total_surveys: number;
  total_responses: number;
  average_rating: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps_score: number;
  recent_responses: Array<{
    id: string;
    survey_id: string;
    user_id: string;
    user_name?: string | null;
    rating?: number | null;
    created_at: string;
  }>;
}

interface ReferralOverview {
  total_codes: number;
  total_uses: number;
  total_referrals: number;
  total_points_awarded: number;
  top_referrers: Array<{
    user_id: string;
    user_name?: string | null;
    referral_count: number;
    points_earned: number;
  }>;
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
  const [triggers, setTriggers] = useState<CRMTrigger[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [referralHistory, setReferralHistory] = useState<ReferralHistoryItem[]>([]);
  const [segmentExports, setSegmentExports] = useState<SegmentExportJob[]>([]);
  const [surveyInsights, setSurveyInsights] = useState<SurveyInsights | null>(null);
  const [referralOverview, setReferralOverview] = useState<ReferralOverview | null>(null);
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
  const [triggerSaving, setTriggerSaving] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [lastAutomationRun, setLastAutomationRun] = useState<AutomationRunSummary | null>(null);
  const [surveySaving, setSurveySaving] = useState(false);
  const [referralSaving, setReferralSaving] = useState(false);
  const [segmentExporting, setSegmentExporting] = useState(false);
  const [segmentExportRunning, setSegmentExportRunning] = useState(false);

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
  const [triggerName, setTriggerName] = useState("");
  const [triggerEventType, setTriggerEventType] = useState("signup");
  const [triggerDelayHours, setTriggerDelayHours] = useState("1");
  const [triggerActionType, setTriggerActionType] = useState("notification");
  const [triggerMessageTitle, setTriggerMessageTitle] = useState("แจ้งเตือนจาก Saversure");
  const [triggerMessageBody, setTriggerMessageBody] = useState("สวัสดี {{first_name}}");
  const [triggerTagID, setTriggerTagID] = useState("");
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyTriggerEvent, setSurveyTriggerEvent] = useState("manual");
  const [surveyQuestionsText, setSurveyQuestionsText] = useState(
    JSON.stringify(
      [
        { type: "rating", label: "คุณพึงพอใจกับ Saversure มากแค่ไหน (0-10)?" },
        { type: "text", label: "มีอะไรที่อยากให้เราปรับปรุงเพิ่มเติม?" },
      ],
      null,
      2,
    ),
  );
  const [referralUserID, setReferralUserID] = useState("");
  const [referralCodeText, setReferralCodeText] = useState("");
  const [referralMaxUses, setReferralMaxUses] = useState("");
  const [referralRewardReferrer, setReferralRewardReferrer] = useState("20");
  const [referralRewardReferee, setReferralRewardReferee] = useState("20");

  const loadAll = async (riskLevel = selectedRisk) => {
    setLoading(true);
    try {
      const [tagsRes, segmentsRes, distRes, broadcastsRes, triggersRes, surveysRes, surveyInsightsRes, referralCodesRes, referralHistoryRes, referralOverviewRes, segmentExportsRes, customersRes] = await Promise.all([
        api.get<{ data: Tag[] }>("/api/v1/crm/tags"),
        api.get<{ data: Segment[] }>("/api/v1/crm/segments"),
        api.get<{ data: RFMDistributionItem[] }>("/api/v1/crm/rfm/distribution"),
        api.get<{ data: BroadcastCampaign[] }>("/api/v1/crm/broadcasts?limit=20"),
        api.get<{ data: CRMTrigger[] }>("/api/v1/crm/triggers"),
        api.get<{ data: Survey[] }>("/api/v1/crm/surveys"),
        api.get<SurveyInsights>("/api/v1/crm/survey-insights?limit=5"),
        api.get<{ data: ReferralCode[] }>("/api/v1/crm/referral-codes?limit=20"),
        api.get<{ data: ReferralHistoryItem[] }>("/api/v1/crm/referral-history?limit=20"),
        api.get<ReferralOverview>("/api/v1/crm/referral-overview?limit=5"),
        api.get<{ data: SegmentExportJob[] }>("/api/v1/crm/segment-exports?limit=20"),
        api.get<{ data: RFMSnapshot[] }>(
          `/api/v1/crm/rfm/customers?limit=20${riskLevel ? `&risk_level=${encodeURIComponent(riskLevel)}` : ""}`,
        ),
      ]);
      setTags(tagsRes.data || []);
      setSegments(segmentsRes.data || []);
      setDistribution(distRes.data || []);
      setBroadcasts(broadcastsRes.data || []);
      setTriggers(triggersRes.data || []);
      setSurveys(surveysRes.data || []);
      setSurveyInsights(surveyInsightsRes);
      setReferralCodes(referralCodesRes.data || []);
      setReferralHistory(referralHistoryRes.data || []);
      setReferralOverview(referralOverviewRes);
      setSegmentExports(segmentExportsRes.data || []);
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

  const handleCreateTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerName.trim()) {
      toast.error("กรุณาระบุชื่อ trigger");
      return;
    }
    if (triggerActionType === "tag_assign" && !triggerTagID) {
      toast.error("กรุณาเลือก tag สำหรับ tag assign");
      return;
    }
    setTriggerSaving(true);
    try {
      const payload =
        triggerActionType === "tag_assign"
          ? { tag_id: triggerTagID }
          : triggerActionType === "line_message"
            ? { message: triggerMessageBody }
            : { title: triggerMessageTitle, body: triggerMessageBody, type: "system" };
      await api.post("/api/v1/crm/triggers", {
        name: triggerName.trim(),
        event_type: triggerEventType,
        delay_hours: Number(triggerDelayHours || 0),
        action_type: triggerActionType,
        action_payload: payload,
        active: true,
      });
      setTriggerName("");
      setTriggerEventType("signup");
      setTriggerDelayHours("1");
      setTriggerActionType("notification");
      setTriggerMessageTitle("แจ้งเตือนจาก Saversure");
      setTriggerMessageBody("สวัสดี {{first_name}}");
      setTriggerTagID("");
      await loadAll(selectedRisk);
      toast.success("สร้าง trigger แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้าง trigger ไม่สำเร็จ");
    } finally {
      setTriggerSaving(false);
    }
  };

  const handleToggleTrigger = async (trigger: CRMTrigger) => {
    try {
      await api.put(`/api/v1/crm/triggers/${trigger.id}`, {
        name: trigger.name,
        event_type: trigger.event_type,
        delay_hours: trigger.delay_hours,
        action_type: trigger.action_type,
        action_payload: trigger.action_payload,
        active: !trigger.active,
      });
      await loadAll(selectedRisk);
      toast.success(trigger.active ? "ปิด trigger แล้ว" : "เปิด trigger แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปเดต trigger ไม่สำเร็จ");
    }
  };

  const handleDeleteTrigger = async (trigger: CRMTrigger) => {
    if (!confirm(`ลบ trigger "${trigger.name}" ?`)) return;
    try {
      await api.delete(`/api/v1/crm/triggers/${trigger.id}`);
      await loadAll(selectedRisk);
      toast.success("ลบ trigger แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบ trigger ไม่สำเร็จ");
    }
  };

  const handleRunAutomation = async () => {
    setAutomationRunning(true);
    try {
      const res = await api.post<AutomationRunSummary>("/api/v1/crm/automation/run", {});
      setLastAutomationRun(res);
      await loadAll(selectedRisk);
      toast.success("รัน automation แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "รัน automation ไม่สำเร็จ");
    } finally {
      setAutomationRunning(false);
    }
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyTitle.trim()) {
      toast.error("กรุณาระบุชื่อ survey");
      return;
    }
    let questions: unknown[];
    try {
      questions = JSON.parse(surveyQuestionsText) as unknown[];
      if (!Array.isArray(questions)) throw new Error("invalid");
    } catch {
      toast.error("questions JSON ไม่ถูกต้อง");
      return;
    }
    setSurveySaving(true);
    try {
      await api.post("/api/v1/crm/surveys", {
        title: surveyTitle.trim(),
        questions,
        trigger_event: surveyTriggerEvent,
        active: true,
      });
      setSurveyTitle("");
      setSurveyTriggerEvent("manual");
      setSurveyQuestionsText(
        JSON.stringify(
          [
            { type: "rating", label: "คุณพึงพอใจกับ Saversure มากแค่ไหน (0-10)?" },
            { type: "text", label: "มีอะไรที่อยากให้เราปรับปรุงเพิ่มเติม?" },
          ],
          null,
          2,
        ),
      );
      await loadAll(selectedRisk);
      toast.success("สร้าง survey แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้าง survey ไม่สำเร็จ");
    } finally {
      setSurveySaving(false);
    }
  };

  const handleCreateReferralCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralUserID.trim()) {
      toast.error("กรุณาระบุ user id");
      return;
    }
    setReferralSaving(true);
    try {
      await api.post("/api/v1/crm/referral-codes", {
        user_id: referralUserID.trim(),
        code: referralCodeText.trim(),
        max_uses: referralMaxUses.trim() === "" ? null : Number(referralMaxUses),
        reward_referrer: Number(referralRewardReferrer || 0),
        reward_referee: Number(referralRewardReferee || 0),
        active: true,
      });
      setReferralUserID("");
      setReferralCodeText("");
      setReferralMaxUses("");
      setReferralRewardReferrer("20");
      setReferralRewardReferee("20");
      await loadAll(selectedRisk);
      toast.success("สร้าง referral code แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้าง referral code ไม่สำเร็จ");
    } finally {
      setReferralSaving(false);
    }
  };

  const handleCreateSegmentExport = async (segment: Segment) => {
    setSegmentExporting(true);
    try {
      await api.post("/api/v1/crm/segment-exports", { segment_id: segment.id });
      await loadAll(selectedRisk);
      toast.success(`queue export สำหรับ segment "${segment.name}" แล้ว`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้าง segment export ไม่สำเร็จ");
    } finally {
      setSegmentExporting(false);
    }
  };

  const handleRunSegmentExportsNow = async () => {
    setSegmentExportRunning(true);
    try {
      await api.post("/api/v1/crm/segment-exports/process", {});
      await loadAll(selectedRisk);
      toast.success("ประมวลผล segment exports แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ประมวลผล segment exports ไม่สำเร็จ");
    } finally {
      setSegmentExportRunning(false);
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
                      <button type="button" disabled={segmentExporting} onClick={() => handleCreateSegmentExport(segment)} className="text-[12px] text-[var(--md-primary)] hover:underline disabled:opacity-60">
                        Export CSV
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

      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Segment Exports</h2>
            <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
              สร้างไฟล์ CSV จากสมาชิกใน segment แบบ async แล้วอัปโหลดขึ้น MinIO เพื่อใช้กับเครื่องมือภายนอก
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunSegmentExportsNow}
            disabled={segmentExportRunning}
            className="h-[40px] px-4 rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] text-[13px] font-medium disabled:opacity-60"
          >
            {segmentExportRunning ? "Processing..." : "Process Queue Now"}
          </button>
        </div>
        <div className="space-y-3">
          {segmentExports.length === 0 ? (
            <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี segment export job</p>
          ) : (
            segmentExports.map((item) => (
              <div key={item.id} className="rounded-[14px] border border-[var(--md-outline-variant)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[var(--md-on-surface)]">{item.segment_name}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                      <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">status {item.status}</span>
                      <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">rows {item.total_rows.toLocaleString()}</span>
                      <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">
                        created {new Date(item.created_at).toLocaleString("th-TH")}
                      </span>
                    </div>
                    {item.error_message && (
                      <p className="mt-2 text-[12px] text-red-500">{item.error_message}</p>
                    )}
                  </div>
                  {item.file_url ? (
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-[var(--md-primary)] hover:underline"
                    >
                      Download
                    </a>
                  ) : null}
                </div>
              </div>
            ))
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

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Lifecycle Automation</h2>
              <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                ใช้สำหรับ point expiry, pre-expiry notify และ simple CRM triggers เช่น welcome / inactive / point expiring
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunAutomation}
              disabled={automationRunning}
              className="h-[40px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium disabled:opacity-60"
            >
              {automationRunning ? "Running..." : "Run Automation Now"}
            </button>
          </div>

          {lastAutomationRun && (
            <div className="mb-4 rounded-[16px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)] p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px] text-[var(--md-on-surface)]">
                <div className="rounded-[12px] bg-[var(--md-surface)] px-3 py-2">
                  <div>expired entries: {lastAutomationRun.point_expiry.processed_entries.toLocaleString()}</div>
                  <div>expired points: {lastAutomationRun.point_expiry.expired_points.toLocaleString()}</div>
                  <div>pre-expiry users notified: {lastAutomationRun.point_expiry.notified_users.toLocaleString()}</div>
                </div>
                <div className="rounded-[12px] bg-[var(--md-surface)] px-3 py-2">
                  <div>processed triggers: {lastAutomationRun.triggers.processed_triggers.toLocaleString()}</div>
                  <div>sent: {lastAutomationRun.triggers.sent.toLocaleString()}</div>
                  <div>skipped: {lastAutomationRun.triggers.skipped.toLocaleString()}</div>
                  <div>failed: {lastAutomationRun.triggers.failed.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateTrigger} className="space-y-3">
            <input
              value={triggerName}
              onChange={(e) => setTriggerName(e.target.value)}
              placeholder="ชื่อ trigger เช่น Welcome หลังสมัคร / At risk 30 วัน"
              className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={triggerEventType}
                onChange={(e) => setTriggerEventType(e.target.value)}
                className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
              >
                <option value="signup">signup</option>
                <option value="first_scan">first_scan</option>
                <option value="days_inactive_30">days_inactive_30</option>
                <option value="days_inactive_90">days_inactive_90</option>
                <option value="point_expiring_7d">point_expiring_7d</option>
              </select>
              <input
                type="number"
                min="0"
                value={triggerDelayHours}
                onChange={(e) => setTriggerDelayHours(e.target.value)}
                placeholder="delay hours"
                className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
              />
              <select
                value={triggerActionType}
                onChange={(e) => setTriggerActionType(e.target.value)}
                className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
              >
                <option value="notification">notification</option>
                <option value="line_message">line_message</option>
                <option value="tag_assign">tag_assign</option>
              </select>
            </div>

            {triggerActionType === "tag_assign" ? (
              <select
                value={triggerTagID}
                onChange={(e) => setTriggerTagID(e.target.value)}
                className="h-[40px] w-full rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
              >
                <option value="">เลือก tag</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                {triggerActionType === "notification" && (
                  <input
                    value={triggerMessageTitle}
                    onChange={(e) => setTriggerMessageTitle(e.target.value)}
                    placeholder="หัวข้อ notification"
                    className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
                  />
                )}
                <textarea
                  value={triggerMessageBody}
                  onChange={(e) => setTriggerMessageBody(e.target.value)}
                  placeholder={
                    triggerActionType === "line_message"
                      ? "ข้อความ LINE เช่น สวัสดี {{first_name}}"
                      : "ข้อความแจ้งเตือน เช่น สวัสดี {{first_name}}"
                  }
                  className="min-h-[110px] w-full px-4 py-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
                />
              </>
            )}

            <div className="rounded-[14px] bg-[var(--md-surface-container)] px-3 py-2 text-[12px] text-[var(--md-on-surface-variant)]">
              รองรับ placeholder: <span className="font-mono">{"{{first_name}}"}</span>, <span className="font-mono">{"{{points}}"}</span>, <span className="font-mono">{"{{expires_at}}"}</span>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={triggerSaving}
                className="h-[40px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium disabled:opacity-60"
              >
                {triggerSaving ? "Saving..." : "Create Trigger"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Trigger List</h2>
          </div>
          <div className="space-y-3">
            {triggers.length === 0 ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี trigger</p>
            ) : (
              triggers.map((trigger) => (
                <div key={trigger.id} className="rounded-[14px] border border-[var(--md-outline-variant)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-[var(--md-on-surface)]">{trigger.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">{trigger.event_type}</span>
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">{trigger.action_type}</span>
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">delay {trigger.delay_hours}h</span>
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">fired {trigger.fired_count.toLocaleString()}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-[var(--md-on-surface-variant)]">
                        {JSON.stringify(trigger.action_payload)}
                      </p>
                      {trigger.last_fired_at && (
                        <p className="mt-1 text-[11px] text-[var(--md-on-surface-variant)]">
                          last fired: {new Date(trigger.last_fired_at).toLocaleString("th-TH")}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${trigger.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                      {trigger.active ? "active" : "inactive"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-3 text-[12px]">
                    <button type="button" onClick={() => handleToggleTrigger(trigger)} className="text-[var(--md-primary)] hover:underline">
                      {trigger.active ? "Pause" : "Resume"}
                    </button>
                    <button type="button" onClick={() => handleDeleteTrigger(trigger)} className="text-red-500 hover:underline">
                      ลบ
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
          <div className="mb-4">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Survey / NPS</h2>
            <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
              สร้างแบบสอบถามแบบง่ายสำหรับ manual หรือ after_redeem และเก็บคะแนนความพึงพอใจไว้ใช้วิเคราะห์ต่อ
            </p>
          </div>

          <form onSubmit={handleCreateSurvey} className="space-y-3">
            <input
              value={surveyTitle}
              onChange={(e) => setSurveyTitle(e.target.value)}
              placeholder="ชื่อ survey เช่น NPS หลังแลกรางวัล"
              className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
            />
            <select
              value={surveyTriggerEvent}
              onChange={(e) => setSurveyTriggerEvent(e.target.value)}
              className="h-[40px] w-full rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
            >
              <option value="manual">manual</option>
              <option value="after_redeem">after_redeem</option>
              <option value="popup">popup</option>
            </select>
            <textarea
              value={surveyQuestionsText}
              onChange={(e) => setSurveyQuestionsText(e.target.value)}
              className="min-h-[180px] w-full px-4 py-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[12px] font-mono"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={surveySaving}
                className="h-[40px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium disabled:opacity-60"
              >
                {surveySaving ? "Saving..." : "Create Survey"}
              </button>
            </div>
          </form>

          {surveyInsights && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                <p className="text-[11px] text-[var(--md-on-surface-variant)]">responses</p>
                <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{surveyInsights.total_responses.toLocaleString()}</p>
              </div>
              <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                <p className="text-[11px] text-[var(--md-on-surface-variant)]">avg rating</p>
                <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{surveyInsights.average_rating.toFixed(1)}</p>
              </div>
              <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                <p className="text-[11px] text-[var(--md-on-surface-variant)]">NPS</p>
                <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{surveyInsights.nps_score.toFixed(0)}</p>
              </div>
              <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                <p className="text-[11px] text-[var(--md-on-surface-variant)]">promoters</p>
                <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{surveyInsights.promoters.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {surveys.length === 0 ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี survey</p>
            ) : (
              surveys.map((survey) => (
                <div key={survey.id} className="rounded-[14px] border border-[var(--md-outline-variant)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-[var(--md-on-surface)]">{survey.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">{survey.trigger_event || "manual"}</span>
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">questions {survey.questions.length}</span>
                        <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">responses {survey.response_count.toLocaleString()}</span>
                        {survey.average_rating != null && (
                          <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">
                            avg rating {survey.average_rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${survey.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                      {survey.active ? "active" : "inactive"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
            <div className="mb-4">
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Referral Program</h2>
              <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                สร้าง referral code ให้ลูกค้าและกำหนดแต้มให้ทั้งผู้แนะนำและผู้ถูกแนะนำ
              </p>
            </div>

            <form onSubmit={handleCreateReferralCode} className="space-y-3">
              <input
                value={referralUserID}
                onChange={(e) => setReferralUserID(e.target.value)}
                placeholder="User ID ของเจ้าของ referral code"
                className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
              />
              <input
                value={referralCodeText}
                onChange={(e) => setReferralCodeText(e.target.value.toUpperCase())}
                placeholder="Code (ปล่อยว่างเพื่อ generate อัตโนมัติ)"
                className="h-[40px] w-full px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] bg-transparent text-[13px]"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="number"
                  min="0"
                  value={referralMaxUses}
                  onChange={(e) => setReferralMaxUses(e.target.value)}
                  placeholder="max uses"
                  className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
                />
                <input
                  type="number"
                  min="0"
                  value={referralRewardReferrer}
                  onChange={(e) => setReferralRewardReferrer(e.target.value)}
                  placeholder="reward referrer"
                  className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
                />
                <input
                  type="number"
                  min="0"
                  value={referralRewardReferee}
                  onChange={(e) => setReferralRewardReferee(e.target.value)}
                  placeholder="reward referee"
                  className="h-[40px] rounded-[var(--md-radius-xl)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={referralSaving}
                  className="h-[40px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium disabled:opacity-60"
                >
                  {referralSaving ? "Saving..." : "Create Referral Code"}
                </button>
              </div>
            </form>

            {referralOverview && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                  <p className="text-[11px] text-[var(--md-on-surface-variant)]">codes</p>
                  <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{referralOverview.total_codes.toLocaleString()}</p>
                </div>
                <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                  <p className="text-[11px] text-[var(--md-on-surface-variant)]">uses</p>
                  <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{referralOverview.total_uses.toLocaleString()}</p>
                </div>
                <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                  <p className="text-[11px] text-[var(--md-on-surface-variant)]">referrals</p>
                  <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{referralOverview.total_referrals.toLocaleString()}</p>
                </div>
                <div className="rounded-[14px] bg-[var(--md-surface-container)] p-3">
                  <p className="text-[11px] text-[var(--md-on-surface-variant)]">points awarded</p>
                  <p className="mt-1 text-[20px] font-bold text-[var(--md-primary)]">{referralOverview.total_points_awarded.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
            <div className="mb-4">
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Referral Codes</h2>
            </div>
            <div className="space-y-3">
              {referralCodes.length === 0 ? (
                <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี referral code</p>
              ) : (
                referralCodes.map((item) => (
                  <div key={item.id} className="rounded-[14px] border border-[var(--md-outline-variant)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-[var(--md-on-surface)]">{item.code}</p>
                        <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                          owner: {item.user_name || item.user_id}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                          <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">uses {item.uses}</span>
                          <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">max {item.max_uses ?? "unlimited"}</span>
                          <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">referrer +{item.reward_referrer}</span>
                          <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">referee +{item.reward_referee}</span>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {item.active ? "active" : "inactive"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-5 md-elevation-1">
            <div className="mb-4">
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Referral History</h2>
            </div>
            <div className="space-y-3">
              {referralHistory.length === 0 ? (
                <p className="text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มี referral history</p>
              ) : (
                referralHistory.map((item) => (
                  <div key={item.id} className="rounded-[14px] border border-[var(--md-outline-variant)] p-4">
                    <p className="text-[14px] font-medium text-[var(--md-on-surface)]">{item.referral_code}</p>
                    <p className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                      {item.referrer_name || item.referrer_id} → {item.referee_name || item.referee_id}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--md-on-surface-variant)]">
                      <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">points {item.points_given.toLocaleString()}</span>
                      <span className="rounded-full bg-[var(--md-surface-container)] px-2 py-0.5">
                        {new Date(item.created_at).toLocaleString("th-TH")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
