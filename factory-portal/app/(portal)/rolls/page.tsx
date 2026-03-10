"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

interface Roll {
  id: string;
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
  batch_prefix: string | null;
  product_name: string | null;
  product_sku: string | null;
  factory_name: string | null;
  mapped_by_name: string | null;
  qc_by_name: string | null;
  actual_ref2_start: number | null;
  actual_ref2_end: number | null;
  waste_count: number;
  ref2_reported_at: string | null;
  ref2_reported_by_name: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  points_per_scan: number;
}

type StatusKey = "printed" | "mapped" | "qc_approved" | "qc_rejected" | "distributed";

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending_print: { label: "รอพิมพ์", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  printed: { label: "รอ Map", bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  mapped: { label: "รอ QC", bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  qc_approved: { label: "QC ผ่าน", bg: "bg-green-50 dark:bg-green-950", text: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
  qc_rejected: { label: "QC ไม่ผ่าน", bg: "bg-red-50 dark:bg-red-950", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  distributed: { label: "จัดส่งแล้ว", bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
};

const filterTabs: { key: string; label: string }[] = [
  { key: "", label: "ทั้งหมด" },
  { key: "printed", label: "รอ Map" },
  { key: "mapped", label: "รอ QC" },
  { key: "qc_rejected", label: "QC ไม่ผ่าน" },
  { key: "qc_approved", label: "QC ผ่าน" },
  { key: "distributed", label: "จัดส่งแล้ว" },
];

const fieldClass = "w-full h-[44px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "");

  const [mapDialog, setMapDialog] = useState<Roll | null>(null);
  const [mapForm, setMapForm] = useState({ product_id: "", evidence_urls: [] as string[], note: "" });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // Report Ref2
  const [ref2Dialog, setRef2Dialog] = useState<Roll | null>(null);
  const [ref2Form, setRef2Form] = useState({ actual_ref2_start: "", actual_ref2_end: "" });

  const fetchRolls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterStatus) params.set("status", filterStatus);
      const data = await api.get<{ data: Roll[]; total: number }>(`/api/v1/rolls?${params}`);
      setRolls(data.data || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => {
    api.get<{ data: Product[] }>("/api/v1/products?status=active")
      .then((d) => setProducts(d.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRolls(); }, [fetchRolls]);

  const refresh = () => fetchRolls();

  const handleOpenMap = (roll: Roll) => {
    setMapForm({ product_id: roll.product_id || "", evidence_urls: [], note: "" });
    setProductSearch("");
    setProductPickerOpen(false);
    setMapDialog(roll);
  };

  const selectedProduct = products.find((p) => p.id === mapForm.product_id);
  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q);
  });

  const handleOpenRef2 = (roll: Roll) => {
    setRef2Form({
      actual_ref2_start: roll.actual_ref2_start?.toString() || "",
      actual_ref2_end: roll.actual_ref2_end?.toString() || "",
    });
    setRef2Dialog(roll);
  };

  const handleSubmitRef2 = async () => {
    if (!ref2Dialog) return;
    const start = parseInt(ref2Form.actual_ref2_start);
    const end = parseInt(ref2Form.actual_ref2_end);
    if (isNaN(start) || isNaN(end)) return alert("กรุณากรอกเลข ref2 ให้ครบ");
    if (end < start) return alert("ref2 ท้ายม้วนต้อง >= ref2 ต้นม้วน");
    setSubmitting(true);
    try {
      await api.post(`/api/v1/rolls/${ref2Dialog.id}/report-ref2`, {
        actual_ref2_start: start,
        actual_ref2_end: end,
      });
      setRef2Dialog(null);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "รายงาน Ref2 ไม่สำเร็จ");
    } finally { setSubmitting(false); }
  };

  const handleUploadEvidence = async (file: File) => {
    setUploading(true);
    try {
      const result = await api.upload("/api/v1/upload/image", file, "file");
      setMapForm((prev) => ({ ...prev, evidence_urls: [...prev.evidence_urls, result.url] }));
    } catch {
      alert("อัปโหลดรูปไม่สำเร็จ");
    } finally { setUploading(false); }
  };

  const handleSubmitMap = async () => {
    if (!mapForm.product_id) return alert("กรุณาเลือกสินค้า");
    if (mapForm.evidence_urls.length === 0) return alert("กรุณาแนบรูปถ่ายอย่างน้อย 1 รูป");
    setSubmitting(true);
    try {
      await api.post(`/api/v1/rolls/${mapDialog!.id}/map`, {
        product_id: mapForm.product_id,
        factory_id: mapDialog!.factory_id,
        evidence_urls: mapForm.evidence_urls,
        note: mapForm.note || undefined,
      });
      setMapDialog(null);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Map ไม่สำเร็จ");
    } finally { setSubmitting(false); }
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—";

  const canMap = (r: Roll) => r.status === "printed" || r.status === "qc_rejected";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold text-[var(--md-on-surface)] tracking-[-0.5px]">
          ม้วนของฉัน
        </h1>
        <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
          รวม {total} ม้วนที่ได้รับ assign
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`h-[34px] px-4 rounded-full text-[13px] font-medium transition-all ${
              filterStatus === tab.key
                ? "bg-[var(--md-primary)] text-white"
                : "bg-[var(--md-surface)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-dim)] border border-[var(--md-outline-variant)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Roll Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-6 h-6 text-[var(--md-on-surface-variant)]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : rolls.length === 0 ? (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] p-12 text-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto text-[var(--md-on-surface-variant)] mb-3 opacity-50">
            <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
          </svg>
          <p className="text-[15px] font-medium text-[var(--md-on-surface)]">ไม่มีม้วนในสถานะนี้</p>
          <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-1">
            {filterStatus ? "ลองเปลี่ยน filter" : "ยังไม่ได้รับ assign ม้วนใดๆ"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rolls.map((r) => {
            const cfg = statusConfig[r.status] || statusConfig.printed;
            return (
              <div
                key={r.id}
                className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[16px] font-bold text-[var(--md-on-surface)]">
                        {r.batch_prefix} #{r.roll_number}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--md-on-surface-variant)]">
                      Serial: {r.serial_start.toLocaleString()} – {r.serial_end.toLocaleString()} ({r.code_count.toLocaleString()} codes)
                    </p>

                    {/* Product info if mapped */}
                    {r.product_name && (
                      <div className="mt-2 flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--md-on-surface-variant)] shrink-0">
                          <path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.1 15.9 0 13.35 0c-1.4 0-2.54.66-3.35 1.66L9 3l-1-1.34C7.18.66 6.04 0 4.65 0 2.1 0 0 2.1 0 4.65c0 .47.11.91.18 1.35H0l-.01 2h20L20 6zm-6.65-4c1.34 0 2.65 1.31 2.65 2.65 0 .47-.14.9-.27 1.35h-4.76c-.13-.45-.27-.88-.27-1.35C11.35 3.31 12.01 2 13.35 2z" />
                          <path d="M0 8v12h20V8H0zm11 9H9v-2H7v2H5v-4h6v4zm4-4h-2v4h-2v-4h-2v-2h6v2z" />
                        </svg>
                        <span className="text-[13px] font-medium text-[var(--md-on-surface)]">
                          {r.product_name}
                          {r.product_sku && <span className="text-[var(--md-on-surface-variant)] font-normal"> ({r.product_sku})</span>}
                        </span>
                      </div>
                    )}

                    {/* QC note if rejected */}
                    {r.status === "qc_rejected" && r.qc_note && (
                      <div className="mt-2 p-2.5 rounded-[var(--md-radius-sm)] bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-0.5">หมายเหตุ QC:</p>
                        <p className="text-[12px] text-red-700 dark:text-red-300">{r.qc_note}</p>
                        {r.qc_by_name && (
                          <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">
                            โดย: {r.qc_by_name} · {formatDate(r.qc_at)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* QC approved info */}
                    {r.status === "qc_approved" && (
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-green-700 dark:text-green-400">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                        QC อนุมัติแล้ว{r.qc_by_name ? ` โดย ${r.qc_by_name}` : ""} · {formatDate(r.qc_at)}
                      </div>
                    )}

                    {/* Mapped info */}
                    {r.mapped_by_name && (
                      <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">
                        Map โดย: {r.mapped_by_name} · {formatDate(r.mapped_at)}
                      </p>
                    )}

                    {/* Actual Ref2 info */}
                    {r.actual_ref2_start != null && r.actual_ref2_end != null ? (
                      <div className="mt-2 flex items-center gap-2 text-[12px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-medium">
                          Ref2: {r.actual_ref2_start.toLocaleString()} – {r.actual_ref2_end.toLocaleString()}
                        </span>
                        {r.waste_count > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">waste {r.waste_count.toLocaleString()}</span>
                        )}
                      </div>
                    ) : r.status !== "pending_print" ? (
                      <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                        ยังไม่ได้ระบุ Ref2 จริงของม้วนนี้
                      </p>
                    ) : null}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {canMap(r) && (
                      <button
                        onClick={() => handleOpenMap(r)}
                        className="h-[38px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[13px] font-medium hover:opacity-90 transition-all"
                      >
                        {r.status === "qc_rejected" ? "Map ใหม่" : "Map สินค้า"}
                      </button>
                    )}
                    {r.status !== "pending_print" && (
                      <button
                        onClick={() => handleOpenRef2(r)}
                        className={`h-[32px] px-4 rounded-[var(--md-radius-xl)] text-[12px] font-medium transition-all ${
                          r.actual_ref2_start != null
                            ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 hover:opacity-80"
                            : "border border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
                        }`}
                      >
                        {r.actual_ref2_start != null ? "แก้ Ref2" : "รายงาน Ref2"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Evidence thumbnails */}
                {r.mapping_evidence_urls.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {r.mapping_evidence_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`evidence ${i + 1}`}
                          className="w-12 h-12 rounded-[var(--md-radius-sm)] object-cover border border-[var(--md-outline-variant)] hover:opacity-80 transition-all"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Map Product Dialog */}
      {mapDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMapDialog(null)} />
          <div className="relative z-10 bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] p-6 w-[520px] max-w-[95vw] md-elevation-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-[18px] font-semibold text-[var(--md-on-surface)] mb-1">
              Map สินค้า
            </h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-5">
              {mapDialog.batch_prefix} #{mapDialog.roll_number} — {mapDialog.code_count.toLocaleString()} codes
            </p>

            <div className="space-y-4">
              {/* Product picker */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1.5">
                  สินค้า *
                </label>

                {/* Selected product preview */}
                <button
                  type="button"
                  onClick={() => setProductPickerOpen((v) => !v)}
                  className="w-full flex items-center gap-3 h-[56px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] bg-[var(--md-surface)] hover:border-[var(--md-primary)] transition-all text-left"
                >
                  {selectedProduct ? (
                    <>
                      {selectedProduct.image_url ? (
                        <img
                          src={selectedProduct.image_url}
                          alt={selectedProduct.name}
                          className="w-9 h-9 rounded-[6px] object-cover flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-[6px] bg-[var(--md-surface-dim)] flex items-center justify-center flex-shrink-0">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-on-surface-variant)] opacity-40">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[var(--md-on-surface)] leading-tight truncate">
                          {selectedProduct.name}
                        </p>
                        <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                          {selectedProduct.sku || "—"} · {selectedProduct.points_per_scan} pts
                        </p>
                      </div>
                    </>
                  ) : (
                    <span className="text-[14px] text-[var(--md-on-surface-variant)] flex-1">
                      — เลือกสินค้า —
                    </span>
                  )}
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 text-[var(--md-on-surface-variant)] flex-shrink-0 transition-transform ${productPickerOpen ? "rotate-180" : ""}`}>
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>

                {/* Dropdown list */}
                {productPickerOpen && (
                  <div className="mt-1 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] bg-[var(--md-surface)] shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-[var(--md-outline-variant)]">
                      <input
                        type="text"
                        placeholder="ค้นหาชื่อสินค้า หรือ SKU..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        autoFocus
                        className="w-full h-[36px] px-3 rounded-[6px] text-[13px] text-[var(--md-on-surface)] bg-[var(--md-surface-dim)] outline-none focus:ring-1 focus:ring-[var(--md-primary)] transition-all"
                      />
                    </div>
                    <div className="max-h-[260px] overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <p className="text-center py-6 text-[13px] text-[var(--md-on-surface-variant)]">ไม่พบสินค้า</p>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setMapForm((prev) => ({ ...prev, product_id: p.id }));
                              setProductPickerOpen(false);
                              setProductSearch("");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--md-surface-dim)] transition-colors text-left ${
                              mapForm.product_id === p.id ? "bg-[var(--md-primary-light)]" : ""
                            }`}
                          >
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="w-10 h-10 rounded-[6px] object-cover flex-shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-[6px] bg-[var(--md-surface-container)] flex items-center justify-center flex-shrink-0">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-on-surface-variant)] opacity-40">
                                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-[var(--md-on-surface)] leading-tight truncate">
                                {p.name}
                              </p>
                              <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">
                                {p.sku || "ไม่มี SKU"} · <span className="font-medium text-[var(--md-primary)]">{p.points_per_scan} pts</span>
                              </p>
                            </div>
                            {mapForm.product_id === p.id && (
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-primary)] flex-shrink-0">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              </svg>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence upload */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1.5">
                  รูปถ่ายหลักฐาน * (อย่างน้อย 1 รูป)
                </label>
                <label className="flex items-center justify-center gap-2 h-[44px] border-2 border-dashed border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface-variant)] cursor-pointer hover:border-[var(--md-primary)] hover:text-[var(--md-primary)] transition-all">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                  </svg>
                  {uploading ? "กำลังอัปโหลด..." : "เลือกรูปถ่าย"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { if (e.target.files?.[0]) handleUploadEvidence(e.target.files[0]); }}
                  />
                </label>
                {mapForm.evidence_urls.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {mapForm.evidence_urls.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded-[var(--md-radius-sm)] border border-[var(--md-outline-variant)]" />
                        <button
                          onClick={() => setMapForm((prev) => ({ ...prev, evidence_urls: prev.evidence_urls.filter((_, idx) => idx !== i) }))}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1.5">
                  หมายเหตุ (ถ้ามี)
                </label>
                <textarea
                  value={mapForm.note}
                  onChange={(e) => setMapForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="ข้อมูลเพิ่มเติม..."
                  rows={2}
                  className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 resize-none transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setMapDialog(null)}
                  className="flex-1 h-[48px] border border-[var(--md-outline)] rounded-[var(--md-radius-xl)] text-[14px] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-dim)] transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmitMap}
                  disabled={submitting || !mapForm.product_id || mapForm.evidence_urls.length === 0}
                  className="flex-1 h-[48px] bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {submitting ? "กำลัง Map..." : "ยืนยัน Map สินค้า"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Ref2 Dialog */}
      {ref2Dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRef2Dialog(null)} />
          <div className="relative z-10 bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] p-6 w-[480px] max-w-[95vw] md-elevation-3">
            <h2 className="text-[18px] font-semibold text-[var(--md-on-surface)] mb-1">
              รายงาน Ref2 จริงของม้วน
            </h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-5">
              ระบุเลข ref2 ต้นม้วนและท้ายม้วนที่ใช้ได้จริงหลังพิมพ์
            </p>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--md-surface-container,#f5f5f5)] rounded-[var(--md-radius-sm)] mb-5 text-[12px]">
              <div><span className="text-[var(--md-on-surface-variant)]">Roll #</span> <span className="font-medium text-[var(--md-on-surface)]">{ref2Dialog.batch_prefix} #{ref2Dialog.roll_number}</span></div>
              <div><span className="text-[var(--md-on-surface-variant)]">Serial</span> <span className="font-medium text-[var(--md-on-surface)]">{ref2Dialog.serial_start.toLocaleString()} – {ref2Dialog.serial_end.toLocaleString()}</span></div>
              <div><span className="text-[var(--md-on-surface-variant)]">จำนวน</span> <span className="font-medium text-[var(--md-on-surface)]">{ref2Dialog.code_count.toLocaleString()} codes</span></div>
              <div><span className="text-[var(--md-on-surface-variant)]">สถานะ</span> <span className="font-medium text-[var(--md-on-surface)]">{statusConfig[ref2Dialog.status]?.label || ref2Dialog.status}</span></div>
            </div>

            {ref2Dialog.ref2_reported_at && (
              <p className="text-[11px] text-[var(--md-on-surface-variant)] mb-3 italic">
                รายงานแล้วโดย {ref2Dialog.ref2_reported_by_name || "—"} เมื่อ {new Date(ref2Dialog.ref2_reported_at).toLocaleString("th-TH")}
              </p>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 uppercase tracking-[0.3px]">Ref2 ต้นม้วน *</label>
                  <input
                    type="number"
                    value={ref2Form.actual_ref2_start}
                    onChange={(e) => setRef2Form({ ...ref2Form, actual_ref2_start: e.target.value })}
                    className={fieldClass}
                    placeholder="เช่น 200000000015"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 uppercase tracking-[0.3px]">Ref2 ท้ายม้วน *</label>
                  <input
                    type="number"
                    value={ref2Form.actual_ref2_end}
                    onChange={(e) => setRef2Form({ ...ref2Form, actual_ref2_end: e.target.value })}
                    className={fieldClass}
                    placeholder="เช่น 200000009820"
                  />
                </div>
              </div>

              {ref2Form.actual_ref2_start && ref2Form.actual_ref2_end && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-[var(--md-radius-sm)] text-[12px] text-blue-700 dark:text-blue-300">
                  <p>จำนวนที่ใช้ได้จริง: <strong>{Math.max(0, parseInt(ref2Form.actual_ref2_end) - parseInt(ref2Form.actual_ref2_start) + 1).toLocaleString()}</strong> codes</p>
                  <p>Waste: <strong>{Math.max(0, ref2Dialog.code_count - (parseInt(ref2Form.actual_ref2_end) - parseInt(ref2Form.actual_ref2_start) + 1)).toLocaleString()}</strong> codes</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRef2Dialog(null)}
                  className="flex-1 h-[48px] border border-[var(--md-outline)] rounded-[var(--md-radius-xl)] text-[14px] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-dim)] transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmitRef2}
                  disabled={submitting || !ref2Form.actual_ref2_start || !ref2Form.actual_ref2_end}
                  className="flex-1 h-[48px] bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {submitting ? "กำลังบันทึก..." : "บันทึก Ref2"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
