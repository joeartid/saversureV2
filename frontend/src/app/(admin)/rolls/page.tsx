"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

interface Roll {
  id: string;
  tenant_id: string;
  batch_id: string;
  roll_number: number;
  serial_start: number;
  serial_end: number;
  code_count: number;
  status: string;
  product_id: string | null;
  factory_id: string | null;
  mapped_by: string | null;
  mapped_at: string | null;
  mapping_evidence_urls: string[];
  mapping_note: string | null;
  qc_by: string | null;
  qc_at: string | null;
  qc_note: string | null;
  qc_evidence_urls: string[];
  distributed_at: string | null;
  created_at: string;
  batch_prefix: string | null;
  product_name: string | null;
  product_sku: string | null;
  factory_name: string | null;
  mapped_by_name: string | null;
  qc_by_name: string | null;
}

interface Stats {
  pending_print: number;
  printed: number;
  mapped: number;
  qc_approved: number;
  qc_rejected: number;
  distributed: number;
  recalled: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  points_per_scan: number;
}

interface Batch {
  id: string;
  prefix: string;
  code_count: number;
  created_at: string;
}

interface Factory {
  id: string;
  name: string;
  code: string | null;
  factory_type?: string;
  export_format?: number;
  codes_per_roll?: number;
  rolls_per_file?: number;
}

interface ExportLog {
  id: string;
  batch_id: string;
  roll_numbers: number[];
  total_codes: number;
  format: string;
  download_token: string;
  expires_at: string;
  download_count: number;
  factory_id: string | null;
  factory_name: string | null;
  exported_by_name: string | null;
  created_at: string;
}

interface ExportResult {
  export: ExportLog;
  download_url: string;
  warnings: { roll_number: number; exported_at: string; exported_by_name: string; factory_name: string }[];
}

function formatRollList(rollNumbers: number[], visibleCount = 6) {
  if (rollNumbers.length === 0) return "—";
  if (rollNumbers.length <= visibleCount) {
    return rollNumbers.map((n) => `#${n}`).join(", ");
  }
  const visible = rollNumbers.slice(0, visibleCount).map((n) => `#${n}`).join(", ");
  return `${visible} +${rollNumbers.length - visibleCount} more`;
}

type StatusKey = "pending_print" | "printed" | "mapped" | "qc_approved" | "qc_rejected" | "distributed" | "recalled";

const statusConfig: Record<StatusKey, { label: string; labelTh: string; bg: string; text: string; dot: string; icon: string }> = {
  pending_print: { label: "Pending Print", labelTh: "รอพิมพ์", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400", icon: "M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" },
  printed: { label: "Printed", labelTh: "พิมพ์แล้ว", bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500", icon: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" },
  mapped: { label: "Mapped", labelTh: "Map แล้ว", bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", icon: "M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15h14v3H5z" },
  qc_approved: { label: "QC Approved", labelTh: "QC ผ่าน", bg: "bg-green-50 dark:bg-green-950", text: "text-green-600 dark:text-green-400", dot: "bg-green-500", icon: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" },
  qc_rejected: { label: "QC Rejected", labelTh: "QC ไม่ผ่าน", bg: "bg-red-50 dark:bg-red-950", text: "text-red-600 dark:text-red-400", dot: "bg-red-500", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" },
  distributed: { label: "Distributed", labelTh: "จัดส่งแล้ว", bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-600", icon: "M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" },
  recalled: { label: "Recalled", labelTh: "เรียกคืน", bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300", dot: "bg-red-600", icon: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" },
};

const pipelineStatuses: StatusKey[] = ["pending_print", "printed", "mapped", "qc_approved", "distributed"];

export default function RollsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><svg className="animate-spin w-6 h-6 text-[var(--md-on-surface-variant)]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}>
      <RollsPage />
    </Suspense>
  );
}

function RollsPage() {
  const searchParams = useSearchParams();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterBatchId, setFilterBatchId] = useState(searchParams.get("batch_id") || "");
  const [filterFactoryId, setFilterFactoryId] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [filterMapped, setFilterMapped] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState<"rolls" | "history">("rolls");
  const [selectingAll, setSelectingAll] = useState(false);

  // Dialog states
  const [mapDialog, setMapDialog] = useState<{ rollIds: string[]; mode: "single" | "bulk" } | null>(null);
  const [mapForm, setMapForm] = useState({ product_id: "", factory_id: "", evidence_urls: [] as string[], note: "" });
  const [qcDialog, setQcDialog] = useState<Roll | null>(null);
  const [qcForm, setQcForm] = useState({ action: "", note: "", evidence_urls: [] as string[] });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flowHelpOpen, setFlowHelpOpen] = useState(false);

  // Export states
  const [exportDialog, setExportDialog] = useState(false);
  const [exportForm, setExportForm] = useState({ factory_id: "", format: "zip", note: "" });
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);

  // QR Preview states
  const [qrPreview, setQrPreview] = useState<{ roll: Roll; codes: { serial_number: number; code: string; ref1: string; ref2: string; url: string; lot_number: string }[] } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ idx: number; status: "loading" | "done" | "error"; data?: { valid: boolean; prefix?: string; serial?: number; batch_status?: string; campaign_name?: string; roll_number?: number; roll_status?: string; product_name?: string; product_sku?: string; points_per_scan?: number; factory_name?: string; mapped_by?: string; mapped_at?: string; qc_by?: string; qc_at?: string; qc_note?: string; code_status?: string; scanned_by?: string }; message?: string } | null>(null);

  // Assign factory dialog
  const [assignDialog, setAssignDialog] = useState<{ rollIds: string[] } | null>(null);
  const [assignFactoryId, setAssignFactoryId] = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRollDetails, setSelectedRollDetails] = useState<Roll[]>([]);

  const buildRollParams = useCallback((options?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams({
      limit: String(options?.limit ?? pageSize),
      offset: String(options?.offset ?? page * pageSize),
    });
    if (filterStatus) params.set("status", filterStatus);
    if (filterBatchId) params.set("batch_id", filterBatchId);
    if (filterFactoryId) params.set("factory_id", filterFactoryId);
    if (filterProductId) params.set("product_id", filterProductId);
    if (filterMapped) params.set("mapped", filterMapped);
    if (filterSearch) params.set("search", filterSearch);
    if (sortBy) {
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
    }
    return params;
  }, [filterStatus, filterBatchId, filterFactoryId, filterProductId, filterMapped, filterSearch, sortBy, sortOrder, page]);

  const fetchRolls = useCallback(async () => {
    try {
      const params = buildRollParams();
      const data = await api.get<{ data: Roll[]; total: number }>(`/api/v1/rolls?${params}`);
      setRolls(data.data || []);
      setTotal(data.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [buildRollParams]);

  const fetchStats = async () => {
    try {
      const data = await api.get<Stats>("/api/v1/rolls/stats");
      setStats(data);
    } catch { /* ignore */ }
  };

  const fetchProducts = async () => {
    try {
      const data = await api.get<{ data: Product[] }>("/api/v1/products?status=active");
      setProducts(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchBatches = async () => {
    try {
      const data = await api.get<{ data: Batch[] }>("/api/v1/batches");
      setBatches(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchFactories = async () => {
    try {
      const data = await api.get<{ data: Factory[] }>("/api/v1/factories");
      setFactories(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchExportHistory = async () => {
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (filterBatchId) params.set("batch_id", filterBatchId);
      const data = await api.get<{ data: ExportLog[]; total: number }>(`/api/v1/exports?${params}`);
      setExportLogs(data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchStats(); fetchProducts(); fetchFactories(); fetchBatches(); fetchExportHistory(); }, []);
  useEffect(() => { setLoading(true); fetchRolls(); }, [fetchRolls]);
  useEffect(() => {
    if (activeTab === "history") {
      fetchExportHistory();
    }
  }, [activeTab, filterBatchId]);
  useEffect(() => {
    setSelectedRollDetails((prev) => {
      if (selectedIds.size === 0) return [];
      const selectedOnPage = rolls.filter((r) => selectedIds.has(r.id));
      const prevOffPage = prev.filter((r) => selectedIds.has(r.id) && !rolls.some((pageRoll) => pageRoll.id === r.id));
      return [...prevOffPage, ...selectedOnPage];
    });
  }, [rolls, selectedIds]);

  const refresh = () => { fetchRolls(); fetchStats(); setSelectedIds(new Set()); setSelectedRollDetails([]); };

  const handlePrepareBatchExport = async () => {
    if (!filterBatchId) return alert("กรุณาเลือก batch ก่อน");
    setSelectingAll(true);
    try {
      const params = buildRollParams({ limit: 5000, offset: 0 });
      const data = await api.get<{ data: Roll[]; total: number }>(`/api/v1/rolls?${params}`);
      const ids = new Set((data.data || []).map((r) => r.id));
      if (ids.size === 0) {
        alert("ไม่พบ rolls ใน batch นี้");
        return;
      }
      setSelectedIds(ids);
      setSelectedRollDetails(data.data || []);
      setExportForm({ factory_id: "", format: "zip", note: "" });
      setExportDialog(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to prepare batch export");
    } finally {
      setSelectingAll(false);
    }
  };

  const handleSelectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const params = buildRollParams({ limit: 5000, offset: 0 });
      const data = await api.get<{ data: Roll[]; total: number }>(`/api/v1/rolls?${params}`);
      setSelectedIds(new Set((data.data || []).map((r) => r.id)));
      setSelectedRollDetails(data.data || []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to select all matching rolls");
    } finally {
      setSelectingAll(false);
    }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setPage(0);
  };

  const hasActiveFilters = !!(filterStatus || filterFactoryId || filterProductId || filterMapped || filterSearch || filterBatchId);

  const clearAllFilters = () => {
    setFilterStatus("");
    setFilterFactoryId("");
    setFilterProductId("");
    setFilterMapped("");
    setFilterSearch("");
    setFilterBatchId("");
    setPage(0);
  };

  const activeFilterTags: { label: string; onRemove: () => void }[] = [];
  if (filterStatus) activeFilterTags.push({ label: `สถานะ: ${statusConfig[filterStatus as StatusKey]?.labelTh || filterStatus}`, onRemove: () => setFilterStatus("") });
  if (filterFactoryId) activeFilterTags.push({ label: `โรงงาน: ${factories.find(f => f.id === filterFactoryId)?.name || "..."}`, onRemove: () => setFilterFactoryId("") });
  if (filterProductId) activeFilterTags.push({ label: `สินค้า: ${products.find(p => p.id === filterProductId)?.name || "..."}`, onRemove: () => setFilterProductId("") });
  if (filterMapped === "true") activeFilterTags.push({ label: "Map แล้ว", onRemove: () => setFilterMapped("") });
  if (filterMapped === "false") activeFilterTags.push({ label: "ยังไม่ Map", onRemove: () => setFilterMapped("") });
  if (filterSearch) activeFilterTags.push({ label: `ค้นหา: "${filterSearch}"`, onRemove: () => setFilterSearch("") });
  if (filterBatchId) activeFilterTags.push({ label: `Batch: ${batches.find((b) => b.id === filterBatchId)?.prefix || "..."}`, onRemove: () => setFilterBatchId("") });

  const totalPages = Math.ceil(total / pageSize);

  const handleMarkPrinted = async (ids: string[]) => {
    if (!confirm(`Mark ${ids.length} roll(s) as printed?`)) return;
    try {
      await api.post("/api/v1/rolls/bulk-status", { roll_ids: ids, status: "printed" });
      refresh();
    } catch { alert("Failed to update status"); }
  };

  const handleMarkDistributed = async (ids: string[]) => {
    if (!confirm(`Mark ${ids.length} roll(s) as distributed?`)) return;
    try {
      await api.post("/api/v1/rolls/bulk-status", { roll_ids: ids, status: "distributed" });
      refresh();
    } catch { alert("Failed to update status"); }
  };

  const handleOpenMapDialog = (ids: string[], mode: "single" | "bulk") => {
    setMapForm({ product_id: "", factory_id: "", evidence_urls: [], note: "" });
    setMapDialog({ rollIds: ids, mode });
  };

  const handleSubmitMap = async () => {
    if (!mapForm.product_id) return alert("กรุณาเลือกสินค้า");
    if (!mapForm.factory_id) return alert("กรุณาเลือกโรงงานแปะสติ๊กเกอร์");
    if (mapForm.evidence_urls.length === 0) return alert("กรุณาแนบรูปถ่ายอย่างน้อย 1 รูป");
    setSubmitting(true);
    try {
      const payload = {
        product_id: mapForm.product_id,
        factory_id: mapForm.factory_id,
        evidence_urls: mapForm.evidence_urls,
        note: mapForm.note || undefined,
      };
      if (mapDialog!.mode === "bulk") {
        await api.post("/api/v1/rolls/bulk-map", {
          roll_ids: mapDialog!.rollIds,
          ...payload,
        });
      } else {
        await api.post(`/api/v1/rolls/${mapDialog!.rollIds[0]}/map`, payload);
      }
      setMapDialog(null);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to map product");
    } finally { setSubmitting(false); }
  };

  const handleUploadMapEvidence = async (file: File) => {
    setUploading(true);
    try {
      const result = await api.upload("/api/v1/upload/image", file, "file");
      setMapForm((prev) => ({ ...prev, evidence_urls: [...prev.evidence_urls, result.url] }));
    } catch {
      alert("Failed to upload file");
    } finally { setUploading(false); }
  };

  const handleUnmap = async (id: string) => {
    if (!confirm("Remove product mapping from this roll?")) return;
    try {
      await api.post(`/api/v1/rolls/${id}/unmap`, {});
      refresh();
    } catch { alert("Failed to unmap"); }
  };

  const handleOpenQcDialog = (roll: Roll) => {
    setQcForm({ action: "", note: "", evidence_urls: [] });
    setQcDialog(roll);
  };

  const handleUploadEvidence = async (file: File) => {
    setUploading(true);
    try {
      const result = await api.upload("/api/v1/upload/image", file, "file");
      setQcForm((prev) => ({ ...prev, evidence_urls: [...prev.evidence_urls, result.url] }));
    } catch {
      alert("Failed to upload file");
    } finally { setUploading(false); }
  };

  const handleSubmitQc = async (action: "approve" | "reject") => {
    setSubmitting(true);
    try {
      await api.post(`/api/v1/rolls/${qcDialog!.id}/qc`, {
        action,
        evidence_urls: qcForm.evidence_urls,
        note: qcForm.note,
      });
      setQcDialog(null);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "QC review failed");
    } finally { setSubmitting(false); }
  };

  const handleExportToFactory = async () => {
    if (selectedIds.size === 0) return;
    if (!isSingleBatchSelection) {
      alert("ไม่อนุญาตให้ export ข้าม batch กรุณาเลือกเฉพาะ rolls ที่อยู่ใน batch เดียวกัน");
      return;
    }
    setSubmitting(true);
    try {
      const batchId = selectedBatchId;
      const result = await api.post<ExportResult>("/api/v1/exports", {
        batch_id: batchId,
        roll_ids: [...selectedIds],
        factory_id: exportForm.factory_id || undefined,
        format: exportForm.format,
        note: exportForm.note || undefined,
      });
      setExportResult(result);
      setExportDialog(false);
      fetchExportHistory();
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async (code: string, idx: number) => {
    setLookupResult({ idx, status: "loading" });
    try {
      const data = await api.get<{ valid: boolean; prefix: string; serial: number; batch_status: string; campaign_name: string; roll_number: number; roll_status: string; product_name: string; product_sku: string; points_per_scan: number; factory_name: string; mapped_by: string; mapped_at: string; qc_by: string; qc_at: string; qc_note: string; code_status: string; scanned_by: string }>(`/api/v1/codes/lookup?code=${encodeURIComponent(code)}`);
      setLookupResult({ idx, status: "done", data });
    } catch (e) {
      setLookupResult({ idx, status: "error", message: e instanceof Error ? e.message : "Lookup failed" });
    }
  };

  const handleQrPreview = async (roll: Roll) => {
    setQrLoading(true);
    setQrPreview({ roll, codes: [] });
    try {
      const data = await api.get<{ codes: { serial_number: number; code: string; ref1: string; ref2: string; url: string; lot_number: string }[] }>(`/api/v1/rolls/${roll.id}/sample-codes?count=10`);
      setQrPreview({ roll, codes: data.codes || [] });
    } catch {
      alert("Failed to load QR codes");
      setQrPreview(null);
    } finally {
      setQrLoading(false);
    }
  };

  const handleAssignFactory = async () => {
    if (!assignFactoryId) return alert("กรุณาเลือกโรงงาน");
    setSubmitting(true);
    try {
      if (assignDialog!.rollIds.length === 1) {
        await api.patch(`/api/v1/rolls/${assignDialog!.rollIds[0]}/assign`, { factory_id: assignFactoryId });
      } else {
        await api.post("/api/v1/rolls/bulk-assign", { roll_ids: assignDialog!.rollIds, factory_id: assignFactoryId });
      }
      setAssignDialog(null);
      setAssignFactoryId("");
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to assign");
    } finally { setSubmitting(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rolls.length) {
      setSelectedIds(new Set());
      setSelectedRollDetails([]);
    } else {
      setSelectedIds(new Set(rolls.map((r) => r.id)));
      setSelectedRollDetails(rolls);
    }
  };

  const selectedRolls = selectedRollDetails;
  const selectedBatchIds = Array.from(new Set(selectedRolls.map((r) => r.batch_id).filter(Boolean)));
  const isSingleBatchSelection = selectedBatchIds.length <= 1;
  const selectedBatchId = selectedBatchIds[0] || "";
  const selectedBatchPrefix = selectedBatchId
    ? batches.find((b) => b.id === selectedBatchId)?.prefix || selectedRolls[0]?.batch_prefix || "—"
    : "—";
  const selectedRollListText = formatRollList(selectedRolls.map((r) => r.roll_number), 10);
  const canBulkPrint = selectedRolls.length > 0 && selectedRolls.every((r) => r.status === "pending_print");
  const canBulkMap = selectedRolls.length > 0 && selectedRolls.every((r) => r.status === "printed" || r.status === "qc_rejected");
  const canBulkDistribute = selectedRolls.length > 0 && selectedRolls.every((r) => r.status === "qc_approved");
  const canExport = selectedRolls.length > 0 && isSingleBatchSelection;
  const canSelectAllMatching = activeTab === "rolls" && total > rolls.length && selectedIds.size < total;
  const stickerFactories = factories.filter((f) => f.factory_type === "sticker_printer");
  const applicatorFactories = factories.filter((f) => f.factory_type === "applicator");

  const fieldClass = "w-full h-[44px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200";

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Roll Management</h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">จัดการม้วนสติ๊กเกอร์ QR Code — Map Product, QC, จัดส่ง</p>
        </div>
        <button
          onClick={() => setFlowHelpOpen(true)}
          className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[var(--md-radius-xl)] text-[13px] font-medium bg-[var(--md-surface)] text-[var(--md-primary)] hover:bg-[var(--md-surface-container)] transition-all"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" />
          </svg>
          ดู Flow การทำงาน
        </button>
      </div>

      {/* Top Tabs */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setActiveTab("rolls")}
          className={`inline-flex items-center gap-2 h-[38px] px-4 rounded-[var(--md-radius-xl)] text-[13px] font-medium transition-all ${
            activeTab === "rolls"
              ? "bg-[var(--md-primary)] text-white"
              : "bg-[var(--md-surface)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)]"
          }`}
        >
          <span>Rolls</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "rolls" ? "bg-white/20 text-white" : "bg-[var(--md-primary-light)] text-[var(--md-primary)]"}`}>
            {total.toLocaleString()}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`inline-flex items-center gap-2 h-[38px] px-4 rounded-[var(--md-radius-xl)] text-[13px] font-medium transition-all ${
            activeTab === "history"
              ? "bg-indigo-600 text-white"
              : "bg-[var(--md-surface)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)]"
          }`}
        >
          <span>Export History</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "history" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
            {exportLogs.length}
          </span>
        </button>
      </div>

      {activeTab === "rolls" && (
        <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <select
            value={filterBatchId}
            onChange={(e) => { setFilterBatchId(e.target.value); setPage(0); setSelectedIds(new Set()); setSelectedRollDetails([]); }}
            className="h-[38px] px-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-[var(--md-surface)] outline-none focus:border-[var(--md-primary)] min-w-[220px]"
          >
            <option value="">ทุก batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.prefix} ({b.code_count.toLocaleString()} codes)
              </option>
            ))}
          </select>
          {filterBatchId && (
            <button
              onClick={handlePrepareBatchExport}
              disabled={selectingAll}
              className="h-[38px] px-4 text-[13px] font-medium bg-indigo-600 text-white rounded-[var(--md-radius-xl)] hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {selectingAll ? "กำลังเตรียม..." : "Export ทั้ง batch"}
            </button>
          )}
        </div>
        {filterBatchId && (
          <p className="text-[12px] text-[var(--md-on-surface-variant)]">
            batch นี้เหมาะกับงาน export ก้อนใหญ่แบบครั้งเดียว
          </p>
        )}
      </div>

      {/* Pipeline View */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {pipelineStatuses.map((status, i) => {
            const cfg = statusConfig[status];
            const count = stats[status];
            const isActive = filterStatus === status;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(isActive ? "" : status)}
                className={`relative flex flex-col items-center p-4 rounded-[var(--md-radius-lg)] border-2 transition-all duration-200 ${
                  isActive
                    ? `${cfg.bg} border-current ${cfg.text}`
                    : "bg-[var(--md-surface)] border-transparent hover:border-[var(--md-outline-variant)]"
                }`}
              >
                <span className={`text-[28px] font-semibold ${isActive ? cfg.text : "text-[var(--md-on-surface)]"}`}>
                  {count}
                </span>
                <span className={`text-[11px] font-medium mt-1 ${isActive ? cfg.text : "text-[var(--md-on-surface-variant)]"}`}>
                  {cfg.labelTh}
                </span>
                {i < pipelineStatuses.length - 1 && (
                  <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-[var(--md-outline-variant)] text-[16px] z-10">→</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Extra status badges for rejected + recalled */}
      {stats && (stats.qc_rejected > 0 || stats.recalled > 0) && (
        <div className="flex gap-3 mb-6">
          {stats.qc_rejected > 0 && (
            <button
              onClick={() => setFilterStatus(filterStatus === "qc_rejected" ? "" : "qc_rejected")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-[var(--md-radius-sm)] text-[13px] font-medium border-2 transition-all ${
                filterStatus === "qc_rejected"
                  ? "bg-red-50 dark:bg-red-950 border-red-300 text-red-600"
                  : "bg-[var(--md-surface)] border-transparent text-red-500 hover:border-red-200"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              QC ไม่ผ่าน: {stats.qc_rejected}
            </button>
          )}
          {stats.recalled > 0 && (
            <button
              onClick={() => setFilterStatus(filterStatus === "recalled" ? "" : "recalled")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-[var(--md-radius-sm)] text-[13px] font-medium border-2 transition-all ${
                filterStatus === "recalled"
                  ? "bg-red-100 dark:bg-red-900 border-red-400 text-red-700"
                  : "bg-[var(--md-surface)] border-transparent text-red-600 hover:border-red-200"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-600" />
              เรียกคืน: {stats.recalled}
            </button>
          )}
          {filterStatus && (
            <button
              onClick={() => setFilterStatus("")}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] transition-all"
            >
              ✕ ล้าง filter
            </button>
          )}
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--md-primary-light)] rounded-[var(--md-radius-sm)]">
          <span className="text-[13px] font-medium text-[var(--md-primary)]">
            เลือก {selectedIds.size} ม้วน
          </span>
          {!isSingleBatchSelection && (
            <span className="inline-flex items-center h-[28px] px-3 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
              Export ข้าม batch ไม่ได้
            </span>
          )}
          {canSelectAllMatching && (
            <button
              onClick={handleSelectAllMatching}
              disabled={selectingAll}
              className="h-[32px] px-4 text-[12px] font-medium bg-[var(--md-primary)] text-white rounded-[var(--md-radius-sm)] hover:bg-[var(--md-primary-dark)] disabled:opacity-50"
            >
              {selectingAll ? "กำลังเลือกทั้งหมด..." : `เลือกทั้งหมดตาม filter (${total.toLocaleString()} ม้วน)`}
            </button>
          )}
          {canBulkPrint && (
            <button onClick={() => handleMarkPrinted([...selectedIds])} className="h-[32px] px-4 text-[12px] font-medium bg-blue-600 text-white rounded-[var(--md-radius-sm)] hover:bg-blue-700">
              Mark Printed
            </button>
          )}
          {canBulkMap && (
            <button onClick={() => handleOpenMapDialog([...selectedIds], "bulk")} className="h-[32px] px-4 text-[12px] font-medium bg-amber-600 text-white rounded-[var(--md-radius-sm)] hover:bg-amber-700">
              Map Product
            </button>
          )}
          {canBulkDistribute && (
            <button onClick={() => handleMarkDistributed([...selectedIds])} className="h-[32px] px-4 text-[12px] font-medium bg-emerald-600 text-white rounded-[var(--md-radius-sm)] hover:bg-emerald-700">
              Mark Distributed
            </button>
          )}
          <button onClick={() => { setAssignFactoryId(""); setAssignDialog({ rollIds: [...selectedIds] }); }} className="h-[32px] px-4 text-[12px] font-medium bg-orange-600 text-white rounded-[var(--md-radius-sm)] hover:bg-orange-700">
            Assign Factory
          </button>
          {canExport && (
            <button onClick={() => { setExportForm({ factory_id: "", format: "zip", note: "" }); setExportDialog(true); }} className="h-[32px] px-4 text-[12px] font-medium bg-indigo-600 text-white rounded-[var(--md-radius-sm)] hover:bg-indigo-700">
              Export to Factory
            </button>
          )}
          {!canExport && selectedIds.size > 0 && !isSingleBatchSelection && (
            <span className="text-[12px] text-amber-700">
              กรุณาเลือกเฉพาะ rolls จาก batch เดียวกันก่อน export
            </span>
          )}
          <button onClick={() => { setSelectedIds(new Set()); setSelectedRollDetails([]); }} className="ml-auto text-[12px] text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
            ยกเลิกเลือก
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--md-on-surface-variant)]"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => { setFilterSearch(e.target.value); setPage(0); }}
            placeholder="ค้นหา prefix, roll number..."
            className="w-full h-[36px] pl-9 pr-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all"
          />
        </div>
        <select
          value={filterFactoryId}
          onChange={(e) => { setFilterFactoryId(e.target.value); setPage(0); }}
          className="h-[36px] px-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] min-w-[140px]"
        >
          <option value="">ทุกโรงงาน</option>
          {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select
          value={filterMapped}
          onChange={(e) => { setFilterMapped(e.target.value); setPage(0); }}
          className="h-[36px] px-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] min-w-[130px]"
        >
          <option value="">Map ทั้งหมด</option>
          <option value="true">Map แล้ว</option>
          <option value="false">ยังไม่ Map</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="h-[36px] px-3 text-[12px] font-medium text-[var(--md-error)] hover:bg-[var(--md-error-light)] rounded-[var(--md-radius-sm)] transition-all flex items-center gap-1"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            ล้าง filter
          </button>
        )}
        <span className="ml-auto text-[12px] text-[var(--md-on-surface-variant)]">
          {total.toLocaleString()} rolls
          {hasActiveFilters && rolls.length < total ? ` (แสดง ${rolls.length})` : ""}
        </span>
      </div>

      {/* Active filter tags */}
      {activeFilterTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {activeFilterTags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 h-[28px] px-3 bg-[var(--md-primary-light)] text-[var(--md-primary)] rounded-full text-[12px] font-medium">
              {tag.label}
              <button onClick={tag.onRemove} className="hover:opacity-70">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="w-10 px-3 py-3.5">
                <input type="checkbox" checked={rolls.length > 0 && selectedIds.size === rolls.length} onChange={toggleSelectAll} className="w-4 h-4 accent-[var(--md-primary)]" />
              </th>
              <SortHeader label="Roll #" col="roll_number" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <th className="text-left px-4 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Serial Range</th>
              <SortHeader label="Product" col="product_name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <SortHeader label="Factory" col="factory_name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <SortHeader label="Status" col="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <SortHeader label="Mapped" col="mapped_at" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <th className="text-right px-4 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center">
                <div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Loading...
                </div>
              </td></tr>
            ) : rolls.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center">
                <div className="text-[var(--md-on-surface-variant)]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" /></svg>
                  <p className="text-[14px]">{filterStatus ? "ไม่มี roll ในสถานะนี้" : "ยังไม่มี roll — สร้าง Batch ใหม่เพื่อสร้าง rolls"}</p>
                </div>
              </td></tr>
            ) : rolls.map((r) => {
              const sc = statusConfig[r.status as StatusKey] || statusConfig.pending_print;
              return (
                <tr key={r.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors duration-150">
                  <td className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 accent-[var(--md-primary)]" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[14px] font-medium text-[var(--md-on-surface)]">
                      {r.batch_prefix || "?"} #{r.roll_number}
                    </p>
                    <p className="text-[11px] text-[var(--md-on-surface-variant)]">{r.code_count.toLocaleString()} codes</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[13px] text-[var(--md-on-surface)]">
                      {r.serial_start.toLocaleString()} – {r.serial_end.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {r.product_name && r.product_id ? (
                      <button onClick={() => { setFilterProductId(r.product_id!); setPage(0); }} className="text-left group" title="คลิกเพื่อ filter สินค้านี้">
                        <p className="text-[13px] text-[var(--md-on-surface)] group-hover:text-[var(--md-primary)] transition-colors">{r.product_name}</p>
                        {r.product_sku && <p className="text-[11px] text-[var(--md-on-surface-variant)] font-mono">{r.product_sku}</p>}
                      </button>
                    ) : (
                      <span className="text-[13px] text-[var(--md-on-surface-variant)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.factory_name && r.factory_id ? (
                      <button onClick={() => { setFilterFactoryId(r.factory_id!); setPage(0); }} className="text-[13px] text-[var(--md-on-surface-variant)] hover:text-[var(--md-primary)] transition-colors" title="คลิกเพื่อ filter โรงงานนี้">
                        {r.factory_name}
                      </button>
                    ) : (
                      <span className="text-[13px] text-[var(--md-on-surface-variant)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--md-radius-sm)] text-[12px] font-medium ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.labelTh}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.mapped_by_name && (
                      <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                        Map: <span className="font-medium">{r.mapped_by_name}</span> · {formatDate(r.mapped_at)}
                      </p>
                    )}
                    {r.qc_by_name && (
                      <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                        QC: <span className="font-medium">{r.qc_by_name}</span> · {formatDate(r.qc_at)}
                      </p>
                    )}
                    {r.qc_note && (
                      <p className="text-[11px] text-[var(--md-on-surface-variant)] italic mt-0.5 truncate max-w-[160px]" title={r.qc_note}>
                        &quot;{r.qc_note}&quot;
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      <ActionBtn label="QR" color="blue" onClick={() => handleQrPreview(r)} />
                      <ActionBtn label="Assign" color="orange" onClick={() => { setAssignFactoryId(r.factory_id || ""); setAssignDialog({ rollIds: [r.id] }); }} />
                      {r.status === "pending_print" && (
                        <ActionBtn label="Mark Printed" color="blue" onClick={() => handleMarkPrinted([r.id])} />
                      )}
                      {(r.status === "printed" || r.status === "qc_rejected") && (
                        <ActionBtn label="Map Product" color="amber" onClick={() => handleOpenMapDialog([r.id], "single")} />
                      )}
                      {r.status === "mapped" && (
                        <>
                          <ActionBtn label="QC Review" color="green" onClick={() => handleOpenQcDialog(r)} />
                          <ActionBtn label="Unmap" color="gray" onClick={() => handleUnmap(r.id)} />
                        </>
                      )}
                      {r.status === "qc_approved" && (
                        <ActionBtn label="Distribute" color="emerald" onClick={() => handleMarkDistributed([r.id])} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--md-outline-variant)]">
            <span className="text-[12px] text-[var(--md-on-surface-variant)]">
              แสดง {(page * pageSize) + 1}–{Math.min((page + 1) * pageSize, total)} จาก {total.toLocaleString()} rolls
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(0)}
                  disabled={page === 0}
                  className="h-[28px] w-[28px] flex items-center justify-center rounded text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] disabled:opacity-30 transition-all"
                  title="หน้าแรก"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6 1.41-1.41zM6 6h2v12H6V6z" /></svg>
                </button>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-[28px] w-[28px] flex items-center justify-center rounded text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] disabled:opacity-30 transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
                </button>
                <span className="px-3 text-[12px] text-[var(--md-on-surface)]">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-[28px] w-[28px] flex items-center justify-center rounded text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] disabled:opacity-30 transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                </button>
                <button
                  onClick={() => setPage(totalPages - 1)}
                  disabled={page >= totalPages - 1}
                  className="h-[28px] w-[28px] flex items-center justify-center rounded text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] disabled:opacity-30 transition-all"
                  title="หน้าสุดท้าย"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6-1.41 1.41zM16 6h2v12h-2V6z" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === "history" && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--md-outline-variant)]">
            <div>
              <h2 className="text-[16px] font-medium text-[var(--md-on-surface)]">Export History</h2>
              <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">
                ดูว่าใคร export อะไรไปแล้วบ้าง พร้อมจำนวนดาวน์โหลด
              </p>
            </div>
            <button
              onClick={fetchExportHistory}
              className="h-[34px] px-3 text-[12px] font-medium text-indigo-700 bg-indigo-50 rounded-[var(--md-radius-sm)] hover:bg-indigo-100 transition-all"
            >
              Refresh
            </button>
          </div>
          {exportLogs.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[var(--md-on-surface-variant)]">ยังไม่มีประวัติ export</p>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead><tr className="border-b border-[var(--md-outline-variant)]">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">Date</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">Batch</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">Rolls</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">Codes</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">Factory</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">By</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">Downloads</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase">Link</th>
              </tr></thead>
              <tbody>
                {exportLogs.map((log) => {
                  const expired = new Date(log.expires_at) < new Date();
                  return (
                    <tr key={log.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)]">
                      <td className="px-4 py-2.5 text-[12px] text-[var(--md-on-surface)]">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="min-w-[120px]">
                          <p className="text-[12px] font-mono text-[var(--md-on-surface)]">
                            {batches.find((b) => b.id === log.batch_id)?.prefix || log.batch_id.slice(0, 8)}
                          </p>
                          <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                            {log.roll_numbers.length} rolls
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--md-on-surface)] font-mono max-w-[260px]" title={log.roll_numbers.map((n) => `#${n}`).join(", ")}>
                        {formatRollList(log.roll_numbers)}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--md-on-surface)]">{log.total_codes.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--md-on-surface-variant)]">{log.factory_name || "—"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--md-on-surface-variant)]">{log.exported_by_name || "—"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--md-on-surface)]">{log.download_count}x</td>
                      <td className="px-4 py-2.5 text-right">
                        {expired ? (
                          <span className="text-[11px] text-[var(--md-error)]">Expired</span>
                        ) : (
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin.replace(':30401', ':30400')}/api/v1/exports/download/${log.download_token}`)}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Copy Link
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Assign Factory Dialog */}
      {assignDialog && (
        <DialogOverlay onClose={() => setAssignDialog(null)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[420px] max-w-full md-elevation-3">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-1">Assign Factory</h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-5">
              กำหนดโรงงานแปะสติ๊กเกอร์สำหรับ {assignDialog.rollIds.length} ม้วน
            </p>
            <div className="space-y-4">
              <select
                value={assignFactoryId}
                onChange={(e) => setAssignFactoryId(e.target.value)}
                className={fieldClass}
              >
                <option value="">— เลือกโรงงาน —</option>
                {applicatorFactories.length > 0 && (
                  <optgroup label="โรงงานแปะสติ๊กเกอร์">
                    {applicatorFactories.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </optgroup>
                )}
                {factories.filter(f => !f.factory_type || f.factory_type === 'general').map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setAssignDialog(null)}
                  className="flex-1 h-[44px] border border-[var(--md-outline)] rounded-[var(--md-radius-xl)] text-[14px] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-dim)] transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAssignFactory}
                  disabled={submitting || !assignFactoryId}
                  className="flex-1 h-[44px] bg-orange-600 text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-orange-700 disabled:opacity-50 transition-all"
                >
                  {submitting ? "กำลัง Assign..." : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Map Product Dialog */}
      {mapDialog && (
        <DialogOverlay onClose={() => setMapDialog(null)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[540px] max-w-full md-elevation-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-1">Map Product</h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-5">
              {mapDialog.mode === "bulk" ? `เลือก ${mapDialog.rollIds.length} ม้วน` : "เลือกสินค้าและโรงงานสำหรับม้วนนี้"}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">Product *</label>
                <select value={mapForm.product_id} onChange={(e) => setMapForm({ ...mapForm, product_id: e.target.value })} className={fieldClass}>
                  <option value="">-- เลือกสินค้า --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.points_per_scan} pts</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">โรงงานแปะสติ๊กเกอร์ *</label>
                <select value={mapForm.factory_id} onChange={(e) => setMapForm({ ...mapForm, factory_id: e.target.value })} className={fieldClass}>
                  <option value="">-- เลือกโรงงาน --</option>
                  {applicatorFactories.length > 0 ? (
                    applicatorFactories.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}{f.code ? ` (${f.code})` : ""}</option>
                    ))
                  ) : (
                    factories.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}{f.code ? ` (${f.code})` : ""}</option>
                    ))
                  )}
                </select>
                {applicatorFactories.length === 0 && factories.length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">ยังไม่มีโรงงานประเภท Applicator — กำลังแสดงโรงงานทั้งหมด</p>
                )}
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">รูปถ่ายหลักฐาน * (ภาพสินค้า+สติ๊กเกอร์ที่แปะแล้ว)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {mapForm.evidence_urls.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-[var(--md-radius-sm)] overflow-hidden border border-[var(--md-outline-variant)]">
                      <img src={url} alt={`evidence-${i}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setMapForm((prev) => ({ ...prev, evidence_urls: prev.evidence_urls.filter((_, j) => j !== i) }))}
                        className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-bl"
                      >✕</button>
                    </div>
                  ))}
                  <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] cursor-pointer hover:border-[var(--md-primary)] transition-colors">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadMapEvidence(e.target.files[0])} />
                    {uploading ? (
                      <svg className="animate-spin w-5 h-5 text-[var(--md-on-surface-variant)]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[var(--md-on-surface-variant)]"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                    )}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">หมายเหตุ</label>
                <textarea
                  value={mapForm.note}
                  onChange={(e) => setMapForm({ ...mapForm, note: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 resize-none"
                  placeholder="หมายเหตุ (optional)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setMapDialog(null)} className="h-[40px] px-5 text-[14px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] transition-all">
                Cancel
              </button>
              <button onClick={handleSubmitMap} disabled={submitting || !mapForm.product_id || !mapForm.factory_id || mapForm.evidence_urls.length === 0} className="h-[40px] px-6 text-[14px] font-medium bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] hover:bg-[var(--md-primary-dark)] disabled:opacity-50 transition-all">
                {submitting ? "Mapping..." : "Confirm Mapping"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Export to Factory Dialog */}
      {exportDialog && (
        <DialogOverlay onClose={() => setExportDialog(false)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[500px] max-w-full md-elevation-3">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-1">Export to Factory</h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-5">
              Export {selectedIds.size} roll(s) — {selectedRolls.reduce((sum, r) => sum + r.code_count, 0).toLocaleString()} codes
            </p>
            <div className="space-y-4">
              <div className="p-3 rounded-[8px] bg-[var(--md-surface-container)] border border-[var(--md-outline-variant)]">
                <p className="text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1">Export Scope</p>
                <p className="text-[13px] font-mono text-[var(--md-on-surface)]">Batch: {selectedBatchPrefix}</p>
                <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1 break-words" title={selectedRolls.map((r) => `#${r.roll_number}`).join(", ")}>
                  Rolls: {selectedRollListText}
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">Sticker Printer Factory</label>
                <select value={exportForm.factory_id} onChange={(e) => setExportForm({ ...exportForm, factory_id: e.target.value })} className={fieldClass}>
                  <option value="">— ไม่ระบุ —</option>
                  {stickerFactories.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}{f.code ? ` (${f.code})` : ""}</option>
                  ))}
                  {stickerFactories.length === 0 && <option disabled>ไม่มีโรงพิมพ์สติ๊กเกอร์ — สร้างใน Factories</option>}
                </select>
                {(() => {
                  const selFactory = stickerFactories.find((f) => f.id === exportForm.factory_id);
                  if (!selFactory) return null;
                  const fmtLabels: Record<number, string> = {
                    1: "Format 1 — Flat CSV",
                    2: "Format 2 — Multi 4 Columns",
                    3: "Format 3 — Multi N Columns (ถาวร)",
                    4: "Format 4 — Single Column",
                  };
                  return (
                    <div className="mt-2 p-3 rounded-[8px] bg-blue-50 border border-blue-200">
                      <p className="text-[12px] font-medium text-blue-800">
                        {fmtLabels[selFactory.export_format || 1] || `Format ${selFactory.export_format}`}
                      </p>
                      <p className="text-[11px] text-blue-600 mt-0.5">
                        {(selFactory.codes_per_roll || 10000).toLocaleString()} codes/roll · {selFactory.rolls_per_file || 4} rolls/file
                      </p>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">File Format</label>
                <select value={exportForm.format} onChange={(e) => setExportForm({ ...exportForm, format: e.target.value })} className={fieldClass}>
                  <option value="zip">ZIP (แนะนำ)</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">Note</label>
                <textarea
                  value={exportForm.note}
                  onChange={(e) => setExportForm({ ...exportForm, note: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 resize-none"
                  placeholder="Optional note..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setExportDialog(false)} className="h-[40px] px-5 text-[14px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] transition-all">
                Cancel
              </button>
              <button onClick={handleExportToFactory} disabled={submitting} className="h-[40px] px-6 text-[14px] font-medium bg-indigo-600 text-white rounded-[var(--md-radius-xl)] hover:bg-indigo-700 disabled:opacity-50 transition-all">
                {submitting ? "Exporting..." : "Generate & Export"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Export Result Dialog */}
      {exportResult && (
        <DialogOverlay onClose={() => setExportResult(null)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[520px] max-w-full md-elevation-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-600"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              </div>
              <div>
                <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Export Created!</h2>
                <p className="text-[13px] text-[var(--md-on-surface-variant)]">{exportResult.export.total_codes.toLocaleString()} codes in {exportResult.export.roll_numbers.length} roll(s)</p>
              </div>
            </div>

            <div className="p-4 bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] mb-4">
              <p className="text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1">Export Detail</p>
              <p className="text-[13px] font-mono text-[var(--md-on-surface)]">
                Batch: {batches.find((b) => b.id === exportResult.export.batch_id)?.prefix || exportResult.export.batch_id.slice(0, 8)}
              </p>
              <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1 break-words" title={exportResult.export.roll_numbers.map((n) => `#${n}`).join(", ")}>
                Rolls: {formatRollList(exportResult.export.roll_numbers, 10)}
              </p>
            </div>

            {exportResult.warnings && exportResult.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-[var(--md-radius-sm)] mb-4">
                <p className="text-[12px] font-medium text-amber-700 dark:text-amber-300 mb-1">Duplicate Warning</p>
                {exportResult.warnings.slice(0, 5).map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400">
                    Roll #{w.roll_number} — exported by {w.exported_by_name} on {w.exported_at} ({w.factory_name})
                  </p>
                ))}
              </div>
            )}

            <div className="p-4 bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] mb-4">
              <label className="block text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-2">Download Link (expires in 7 days)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={exportResult.download_url}
                  className="flex-1 h-[40px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent font-mono"
                />
                <button
                  onClick={() => copyToClipboard(exportResult.download_url)}
                  className="h-[40px] px-4 text-[13px] font-medium bg-indigo-600 text-white rounded-[var(--md-radius-sm)] hover:bg-indigo-700"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setExportResult(null)} className="h-[40px] px-6 text-[14px] font-medium bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] hover:bg-[var(--md-primary-dark)] transition-all">
                Done
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* QR Preview Dialog */}
      {qrPreview && (
        <DialogOverlay onClose={() => setQrPreview(null)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[700px] max-w-[95vw] md-elevation-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">QR Code Preview</h2>
                <p className="text-[13px] text-[var(--md-on-surface-variant)]">
                  {qrPreview.roll.batch_prefix || "?"} #{qrPreview.roll.roll_number} — {qrPreview.roll.product_name || "ยังไม่ map สินค้า"}
                  {qrPreview.roll.product_sku && <span className="font-mono ml-1">({qrPreview.roll.product_sku})</span>}
                </p>
              </div>
              <button onClick={() => setQrPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
            </div>

            {qrPreview.roll.status !== "qc_approved" && qrPreview.roll.status !== "distributed" && (
              <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-950 rounded-[var(--md-radius-sm)] border border-amber-200 dark:border-amber-800">
                <p className="text-[12px] text-amber-700 dark:text-amber-300">
                  Roll นี้ยังไม่ผ่าน QC — consumer จะยังสแกนไม่ได้จนกว่าจะ QC Approved หรือ Distributed
                </p>
              </div>
            )}

            {qrLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin w-6 h-6 text-[var(--md-on-surface-variant)]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {qrPreview.codes.map((c, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] border border-[var(--md-outline-variant)]">
                    <div className="flex-shrink-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(c.url)}`}
                        alt={`QR ${c.serial_number}`}
                        className="w-[100px] h-[100px] rounded bg-white p-1"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-wide">Serial #{c.serial_number.toLocaleString()}</p>
                        <button
                          onClick={() => handleLookup(c.code, i)}
                          disabled={lookupResult?.idx === i && lookupResult.status === "loading"}
                          className="h-[22px] px-2 text-[10px] font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                        >
                          {lookupResult?.idx === i && lookupResult.status === "loading" ? "..." : "Lookup"}
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--md-on-surface-variant)]">URL</p>
                        <button
                          onClick={() => copyToClipboard(c.url)}
                          className="text-[11px] font-mono text-blue-600 hover:text-blue-800 break-all text-left"
                          title="Click to copy"
                        >
                          {c.url}
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <div>
                          <p className="text-[10px] text-[var(--md-on-surface-variant)]">Ref1</p>
                          <button onClick={() => copyToClipboard(c.ref1)} className="text-[11px] font-mono text-[var(--md-on-surface)] hover:text-blue-600" title="Click to copy">{c.ref1}</button>
                        </div>
                        <div>
                          <p className="text-[10px] text-[var(--md-on-surface-variant)]">Ref2</p>
                          <p className="text-[11px] font-mono text-[var(--md-on-surface)]">{c.ref2}</p>
                        </div>
                      </div>
                      {lookupResult?.idx === i && lookupResult.status === "done" && lookupResult.data && (
                        <div className="mt-1 p-2 rounded bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 space-y-0.5">
                          {!lookupResult.data.valid ? (
                            <p className="text-[10px] text-red-600 font-medium">Code ไม่ถูกต้อง</p>
                          ) : (
                            <>
                              <div className="flex gap-2 text-[10px]">
                                <span className="text-[var(--md-on-surface-variant)]">สินค้า:</span>
                                <span className="font-medium text-[var(--md-on-surface)]">{lookupResult.data.product_name || "—"} {lookupResult.data.product_sku ? `(${lookupResult.data.product_sku})` : ""}</span>
                              </div>
                              <div className="flex gap-2 text-[10px]">
                                <span className="text-[var(--md-on-surface-variant)]">โรงงาน:</span>
                                <span className="font-medium text-[var(--md-on-surface)]">{lookupResult.data.factory_name || "—"}</span>
                              </div>
                              <div className="flex gap-2 text-[10px]">
                                <span className="text-[var(--md-on-surface-variant)]">Roll:</span>
                                <span className="font-medium text-[var(--md-on-surface)]">#{lookupResult.data.roll_number || "—"}</span>
                                <span className={`px-1 rounded text-[9px] font-medium ${lookupResult.data.roll_status === "qc_approved" || lookupResult.data.roll_status === "distributed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                  {lookupResult.data.roll_status || "—"}
                                </span>
                              </div>
                              {lookupResult.data.points_per_scan != null && (
                                <div className="flex gap-2 text-[10px]">
                                  <span className="text-[var(--md-on-surface-variant)]">Point/scan:</span>
                                  <span className="font-bold text-green-700">{lookupResult.data.points_per_scan}</span>
                                </div>
                              )}
                              {lookupResult.data.mapped_by && (
                                <div className="flex gap-2 text-[10px]">
                                  <span className="text-[var(--md-on-surface-variant)]">Map โดย:</span>
                                  <span className="text-[var(--md-on-surface)]">{lookupResult.data.mapped_by}</span>
                                </div>
                              )}
                              {lookupResult.data.qc_by && (
                                <div className="flex gap-2 text-[10px]">
                                  <span className="text-[var(--md-on-surface-variant)]">QC โดย:</span>
                                  <span className="text-[var(--md-on-surface)]">{lookupResult.data.qc_by}</span>
                                </div>
                              )}
                              {lookupResult.data.code_status && (
                                <div className="flex gap-2 text-[10px]">
                                  <span className="text-[var(--md-on-surface-variant)]">สถานะ code:</span>
                                  <span className="font-medium text-amber-700">{lookupResult.data.code_status}{lookupResult.data.scanned_by ? ` (โดย ${lookupResult.data.scanned_by})` : ""}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {lookupResult?.idx === i && lookupResult.status === "error" && (
                        <div className="mt-1 p-1.5 rounded text-[10px] bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                          {lookupResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-[var(--md-radius-sm)]">
              <p className="text-[12px] text-blue-700 dark:text-blue-300">
                สแกน QR code ข้างบนด้วยมือถือเพื่อทดสอบ flow consumer — หรือคลิก URL เพื่อ copy
              </p>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* QC Review Dialog */}
      {qcDialog && (
        <DialogOverlay onClose={() => setQcDialog(null)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[600px] max-w-full md-elevation-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-1">QC Review</h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-5">ตรวจสอบหลักฐานที่โรงงานส่งมา แล้วอนุมัติหรือปฏิเสธ</p>

            {/* Roll info */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] mb-5">
              <InfoRow label="Roll #" value={`${qcDialog.batch_prefix || "?"} #${qcDialog.roll_number}`} />
              <InfoRow label="Serial" value={`${qcDialog.serial_start.toLocaleString()} – ${qcDialog.serial_end.toLocaleString()}`} />
              <InfoRow label="Product" value={qcDialog.product_name || "—"} />
              <InfoRow label="Factory" value={qcDialog.factory_name || "—"} />
              <InfoRow label="Mapped by" value={qcDialog.mapped_by_name || "—"} />
              <InfoRow label="Mapped at" value={formatDate(qcDialog.mapped_at)} />
            </div>

            {/* Factory evidence photos — สิ่งสำคัญที่ QC ต้องดู */}
            <div className="mb-5">
              <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-2">
                หลักฐานที่โรงงานส่งมา ({qcDialog.mapping_evidence_urls?.length || 0} รูป)
              </p>
              {!qcDialog.mapping_evidence_urls || qcDialog.mapping_evidence_urls.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-[var(--md-radius-sm)] bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-600 flex-shrink-0">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                  <p className="text-[12px] text-amber-700 dark:text-amber-400">โรงงานไม่ได้แนบรูปหลักฐานมา</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {qcDialog.mapping_evidence_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="relative w-24 h-24 rounded-[var(--md-radius-sm)] overflow-hidden border-2 border-[var(--md-outline-variant)] hover:border-[var(--md-primary)] transition-colors group block"
                    >
                      <img src={url} alt={`factory-evidence-${i}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.44-6.19l-2.35 3.02-1.56-1.88c-.2-.25-.57-.24-.76.02l-1.74 2.33c-.24.32-.02.78.39.78h8.98c.4 0 .63-.46.37-.78l-2.55-3.46c-.19-.26-.57-.27-.78-.03z" />
                        </svg>
                      </div>
                      <span className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1 rounded-tl">{i + 1}</span>
                    </a>
                  ))}
                </div>
              )}
              {qcDialog.mapping_note && (
                <p className="mt-2 text-[12px] text-[var(--md-on-surface-variant)] italic">
                  หมายเหตุจากโรงงาน: &ldquo;{qcDialog.mapping_note}&rdquo;
                </p>
              )}
            </div>

            {/* QC Note — บังคับกรณี Reject */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">
                หมายเหตุ QC <span className="text-[var(--md-error)]">(บังคับกรณี Reject)</span>
              </label>
              <textarea
                value={qcForm.note}
                onChange={(e) => setQcForm({ ...qcForm, note: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 resize-none"
                placeholder="ระบุเหตุผลถ้า Reject หรือบันทึก QC เพิ่มเติม..."
              />
            </div>

            {/* QC evidence upload — optional */}
            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-[0.4px]">
                รูปถ่าย QC เพิ่มเติม <span className="text-[var(--md-on-surface-variant)] font-normal normal-case">(ไม่บังคับ)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {qcForm.evidence_urls.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-[var(--md-radius-sm)] overflow-hidden border border-[var(--md-outline-variant)]">
                    <img src={url} alt={`qc-evidence-${i}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setQcForm((prev) => ({ ...prev, evidence_urls: prev.evidence_urls.filter((_, j) => j !== i) }))}
                      className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-bl"
                    >✕</button>
                  </div>
                ))}
                <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] cursor-pointer hover:border-[var(--md-primary)] transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadEvidence(e.target.files[0])} />
                  {uploading ? (
                    <svg className="animate-spin w-5 h-5 text-[var(--md-on-surface-variant)]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[var(--md-on-surface-variant)]"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                  )}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setQcDialog(null)} className="h-[40px] px-5 text-[14px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] transition-all">
                Cancel
              </button>
              <button
                onClick={() => handleSubmitQc("reject")}
                disabled={submitting || !qcForm.note}
                className="h-[40px] px-5 text-[14px] font-medium bg-[var(--md-error)] text-white rounded-[var(--md-radius-xl)] hover:opacity-90 disabled:opacity-50 transition-all"
              >
                Reject
              </button>
              <button
                onClick={() => handleSubmitQc("approve")}
                disabled={submitting}
                className="h-[40px] px-6 text-[14px] font-medium bg-green-600 text-white rounded-[var(--md-radius-xl)] hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {submitting ? "Processing..." : "Approve"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Flow Help Dialog */}
      {flowHelpOpen && (
        <DialogOverlay onClose={() => setFlowHelpOpen(false)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[760px] max-w-[95vw] md-elevation-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-[20px] font-medium text-[var(--md-on-surface)]">Flow การทำงานของ Roll Management</h2>
                <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-1">
                  ใช้เป็นแนวทางกลางสำหรับทีมแบรนด์ โรงงานพิมพ์ และโรงงานแปะสติ๊กเกอร์ ถ้า flow เปลี่ยนในอนาคต ให้กลับมาแก้ข้อความใน popup นี้ได้ทันที
                </p>
              </div>
              <button onClick={() => setFlowHelpOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="p-4 rounded-[var(--md-radius-sm)] bg-blue-50 border border-blue-200">
                <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-blue-700 mb-2">1. Brand / Admin</p>
                <p className="text-[13px] text-[var(--md-on-surface)] leading-6">
                  สร้าง batch, สร้าง rolls, assign โรงงานแปะสติ๊กเกอร์, export file ให้โรงงานพิมพ์, ตรวจ QC และติดตามสถานะรวมทั้งหมด
                </p>
              </div>
              <div className="p-4 rounded-[var(--md-radius-sm)] bg-indigo-50 border border-indigo-200">
                <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-indigo-700 mb-2">2. Sticker Printer</p>
                <p className="text-[13px] text-[var(--md-on-surface)] leading-6">
                  รับไฟล์ export ตาม format ของโรงพิมพ์ แล้วพิมพ์ QR code/sticker ออกมาตามม้วนที่ระบบส่งให้
                </p>
              </div>
              <div className="p-4 rounded-[var(--md-radius-sm)] bg-amber-50 border border-amber-200">
                <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-amber-700 mb-2">3. Applicator Factory</p>
                <p className="text-[13px] text-[var(--md-on-surface)] leading-6">
                  รับม้วนที่ถูก assign แล้วนำไปแปะกับสินค้า, map product, แนบหลักฐาน และรอ QC จากฝั่งแบรนด์
                </p>
              </div>
            </div>

            <div className="p-4 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] border border-[var(--md-outline-variant)] mb-5">
              <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-3">ลำดับการทำงานแนะนำ</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--md-primary)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0">1</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--md-on-surface)]">แบรนด์สร้าง Batch และ Rolls</p>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">กำหนดชุดงานที่จะใช้พิมพ์และติดตามได้ว่า QR อยู่ใน batch ไหน ม้วนไหน</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--md-primary)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0">2</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--md-on-surface)]">แบรนด์ Export ให้โรงงานพิมพ์</p>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">ควร export ทีละ batch เพื่อกันความสับสน และระบบจะเก็บประวัติว่า export batch ไหน ม้วนอะไรบ้าง</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--md-primary)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0">3</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--md-on-surface)]">โรงงานพิมพ์พิมพ์สติ๊กเกอร์ แล้ว admin mark เป็น Printed</p>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">เมื่อพิมพ์เสร็จแล้ว ม้วนจะพร้อมสำหรับการ assign และ map สินค้า</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--md-primary)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0">4</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--md-on-surface)]">แบรนด์ Assign ม้วนให้โรงงานแปะสติ๊กเกอร์</p>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">บอกชัดว่าม้วนไหนเป็นสิทธิของ applicator โรงงานไหน เพื่อลดการหยิบงานผิดชุด</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--md-primary)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0">5</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--md-on-surface)]">โรงงานแปะสติ๊กเกอร์ทำการ Map Product</p>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">เลือกสินค้า, ระบุโรงงาน, แนบภาพหลักฐาน เพื่อยืนยันว่าม้วนนี้ถูกแปะกับสินค้าจริงแล้ว</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--md-primary)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0">6</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--md-on-surface)]">แบรนด์ทำ QC Review</p>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">ถ้าผ่านจะกลายเป็น QC Approved ถ้าไม่ผ่านให้ reject และกลับไปแก้ไขได้</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--md-primary)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0">7</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--md-on-surface)]">จัดส่ง / ปล่อยใช้งานจริง</p>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">หลัง QC ผ่านแล้วจึง mark distributed เพื่อใช้ติดตามงานปลายทางและพร้อมสำหรับ consumer flow</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-[var(--md-radius-sm)] border border-[var(--md-outline-variant)]">
                <p className="text-[12px] font-medium text-[var(--md-on-surface)] mb-2">หลักการสำคัญ</p>
                <ul className="space-y-1.5 text-[12px] text-[var(--md-on-surface-variant)]">
                  <li>Export ควรทำภายใน batch เดียวกัน</li>
                  <li>Assign ให้ชัดก่อนเริ่ม map</li>
                  <li>Map แล้วต้องมีหลักฐานแนบ</li>
                  <li>QC ผ่านก่อนจึงค่อยปล่อยใช้งานจริง</li>
                </ul>
              </div>
              <div className="p-4 rounded-[var(--md-radius-sm)] border border-[var(--md-outline-variant)]">
                <p className="text-[12px] font-medium text-[var(--md-on-surface)] mb-2">ถ้า flow ในอนาคตเปลี่ยน</p>
                <p className="text-[12px] text-[var(--md-on-surface-variant)] leading-6">
                  ให้แก้ข้อความใน popup นี้ให้ตรงกับขั้นตอนจริง เช่น ถ้ามีหน้า export แยก, มี factory portal ที่ทำ map เอง, หรือมีขั้นตอนรับงาน/ส่งงานเพิ่ม ก็ควรอัปเดตคำอธิบายตรงนี้ก่อนเพื่อให้ทุกฝ่ายเข้าใจตรงกัน
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setFlowHelpOpen(false)} className="h-[40px] px-6 text-[14px] font-medium bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] hover:bg-[var(--md-primary-dark)] transition-all">
                ปิด
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900",
    amber: "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 dark:hover:bg-amber-900",
    green: "text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900",
    emerald: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900",
    gray: "text-gray-600 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700",
    red: "text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900",
    orange: "text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900",
  };
  return (
    <button
      onClick={onClick}
      className={`h-[26px] px-2.5 text-[10px] font-medium whitespace-nowrap rounded-[var(--md-radius-sm)] transition-all duration-200 ${colorMap[color] || colorMap.gray}`}
    >
      {label}
    </button>
  );
}

function SortHeader({ label, col, sortBy, sortOrder, onSort }: { label: string; col: string; sortBy: string; sortOrder: string; onSort: (col: string) => void }) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="text-left px-4 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase cursor-pointer select-none hover:text-[var(--md-on-surface)] transition-colors group"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3.5 h-3.5 transition-all ${active ? "text-[var(--md-primary)]" : "opacity-0 group-hover:opacity-40"}`}>
          {active && sortOrder === "desc"
            ? <path d="M7 14l5 5 5-5H7z" />
            : <path d="M7 10l5-5 5 5H7z" />}
        </svg>
      </span>
    </th>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px]">{label}</p>
      <p className="text-[13px] text-[var(--md-on-surface)] font-medium mt-0.5">{value}</p>
    </div>
  );
}

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
