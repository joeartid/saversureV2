"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/* ─── Types ─── */
interface Transaction {
  id: string;
  user_id: string;
  reward_id: string;
  reward_name: string | null;
  user_name: string | null;
  user_phone: string | null;
  status: string;
  tracking: string | null;
  delivery_type: string | null;
  coupon_code: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  district: string | null;
  sub_district: string | null;
  province: string | null;
  postal_code: string | null;
  confirmed_at: string | null;
  expires_at: string;
  created_at: string;
}

interface StatusCount {
  status: string;
  count: number;
}

/* ─── Constants ─── */
const ALL_STATUSES = ["PENDING", "CONFIRMED", "SHIPPING", "SHIPPED", "COMPLETED", "CANCELLED", "EXPIRED"] as const;

const statusMeta: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:   { label: "รอดำเนินการ", color: "#ed6c02", bg: "#fff3e0", icon: "⏳" },
  CONFIRMED: { label: "ยืนยันแล้ว", color: "#0288d1", bg: "#e1f5fe", icon: "✅" },
  SHIPPING:  { label: "กำลังจัดส่ง", color: "#e65100", bg: "#fff3e0", icon: "📦" },
  SHIPPED:   { label: "จัดส่งแล้ว", color: "#2e7d32", bg: "#e8f5e9", icon: "🚚" },
  COMPLETED: { label: "สำเร็จ",    color: "#1b5e20", bg: "#e8f5e9", icon: "🎉" },
  CANCELLED: { label: "ยกเลิก",    color: "#c62828", bg: "#ffebee", icon: "❌" },
  EXPIRED:   { label: "หมดอายุ",   color: "#757575", bg: "#f5f5f5", icon: "⌛" },
};

const nextStatus: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["SHIPPED"],
  SHIPPED: ["COMPLETED"],
};

const deliveryLabel: Record<string, string> = {
  shipping: "จัดส่ง", coupon: "คูปอง", digital: "ดิจิทัล",
  pickup: "รับหน้าร้าน", ticket: "ตั๋ว", none: "ไม่ระบุ",
};

type SortCol = "created_at" | "status" | "reward_name" | "user_name" | "confirmed_at" | "tracking";

/* ─── Helpers ─── */
function compactAddress(t: Transaction) {
  return [t.address_line1, t.sub_district, t.district, t.province, t.postal_code].filter(Boolean).join(" ");
}

function buildLabelHTML(items: Transaction[]) {
  const pages = items.map((t) => {
    const address = compactAddress(t);
    return `
      <div class="sheet" style="page-break-after: always;">
        <div class="title">ใบปะหน้าจัดส่ง</div>
        <div class="grid">
          <div class="label">รายการ</div><div class="value">${t.reward_name || "-"}</div>
          <div class="label">เลขที่รายการ</div><div class="value">${t.id}</div>
          <div class="label">ผู้รับ</div><div class="value">${t.recipient_name || t.user_name || "-"}</div>
          <div class="label">เบอร์โทร</div><div class="value">${t.recipient_phone || t.user_phone || "-"}</div>
          <div class="label">ที่อยู่</div><div class="value">${address || "-"}</div>
          <div class="label">Tracking</div><div class="value">${t.tracking || "-"}</div>
          <div class="label">สถานะ</div><div class="value">${t.status}</div>
        </div>
        <div class="muted">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
      </div>`;
  });
  return `<html><head><title>Shipping Labels</title><style>
    @media print { .sheet { page-break-after: always; } .sheet:last-child { page-break-after: auto; } }
    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; margin: 0; }
    .sheet { border: 2px solid #111827; border-radius: 12px; padding: 24px; max-width: 720px; margin: 0 auto 32px; }
    .title { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 160px 1fr; gap: 10px 16px; margin-top: 16px; }
    .label { font-weight: 700; color: #4b5563; }
    .value { white-space: pre-wrap; }
    .muted { color: #6b7280; font-size: 12px; margin-top: 16px; }
  </style></head><body>${pages.join("")}</body></html>`;
}

/* ─── Main Page ─── */
export default function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [rewardFilter, setRewardFilter] = useState<{ id: string; name: string } | null>(null);
  const [sortBy, setSortBy] = useState<SortCol>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customerPanel, setCustomerPanel] = useState<Transaction | null>(null);
  const limit = 30;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (statusFilter) p.set("status", statusFilter);
    if (search) p.set("search", search);
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (deliveryFilter) p.set("delivery_type", deliveryFilter);
    if (rewardFilter) p.set("reward_id", rewardFilter.id);
    if (sortBy) p.set("sort_by", sortBy);
    if (sortDir) p.set("sort_dir", sortDir);
    return p;
  }, [page, statusFilter, search, dateFrom, dateTo, deliveryFilter, rewardFilter, sortBy, sortDir]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [listRes, summaryRes] = await Promise.all([
        api.get<{ data: Transaction[]; total: number }>(`/api/v1/redeem-transactions?${params}`),
        api.get<{ data: StatusCount[] }>(`/api/v1/redeem-transactions/summary?${params}`),
      ]);
      setTxns(listRes.data || []);
      setTotal(listRes.total || 0);
      setSummary(summaryRes.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(0); }, 400);
  };

  const handleSort = (col: SortCol) => {
    if (sortBy === col) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); }
    else { setSortBy(col); setSortDir("asc"); }
    setPage(0);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    let tracking = "";
    if (status === "SHIPPING" || status === "SHIPPED") {
      tracking = prompt("Tracking number (optional):") || "";
    }
    setActionId(id);
    try {
      await api.patch(`/api/v1/redeem-transactions/${id}`, { status, tracking });
      fetchData();
    } catch { alert("Failed to update"); } finally { setActionId(null); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === txns.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(txns.map((t) => t.id))); }
  };

  const batchPrint = () => {
    const items = txns.filter((t) => selectedIds.has(t.id) && t.delivery_type === "shipping" && t.address_line1);
    if (items.length === 0) { alert("ไม่มีรายการ shipping ที่เลือก หรือไม่มีข้อมูลที่อยู่"); return; }
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(buildLabelHTML(items));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const exportCSV = () => {
    const params = buildParams();
    params.delete("limit");
    params.delete("offset");
    window.open(`/api/v1/redeem-transactions/export?${params}`, "_blank");
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const summaryTotal = summary.reduce((s, c) => s + c.count, 0);

  const SortArrow = ({ col }: { col: SortCol }) => (
    <span className="ml-1 text-[10px]">
      {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const thBtn = "flex items-center cursor-pointer hover:text-[var(--md-primary)] transition-colors select-none";
  const inputCls = "h-[36px] px-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] transition-colors";

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Transactions</h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">{total.toLocaleString()} รายการ</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={batchPrint} className="h-[36px] px-4 text-[13px] font-medium rounded-[var(--md-radius-sm)] text-white bg-[var(--md-primary)] hover:opacity-90 transition-all flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              พิมพ์ใบปะหน้า ({selectedIds.size})
            </button>
          )}
          <button onClick={exportCSV} className="h-[36px] px-4 text-[13px] font-medium rounded-[var(--md-radius-sm)] text-[var(--md-on-surface)] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] transition-all flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ─── Dashboard Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <button
          onClick={() => { setStatusFilter(""); setPage(0); }}
          className={`rounded-xl p-3 text-left transition-all border-2 ${!statusFilter ? "border-[var(--md-primary)] shadow-sm" : "border-transparent hover:border-[var(--md-outline-variant)]"} bg-[var(--md-surface)]`}
        >
          <p className="text-[11px] text-[var(--md-on-surface-variant)] font-medium">ทั้งหมด</p>
          <p className="text-[22px] font-bold text-[var(--md-on-surface)] mt-1">{summaryTotal.toLocaleString()}</p>
        </button>
        {ALL_STATUSES.map((s) => {
          const meta = statusMeta[s];
          const count = summary.find((sc) => sc.status === s)?.count || 0;
          if (count === 0 && !statusFilter) return null;
          return (
            <button
              key={s}
              onClick={() => { setStatusFilter(statusFilter === s ? "" : s); setPage(0); }}
              className={`rounded-xl p-3 text-left transition-all border-2 ${statusFilter === s ? "border-[var(--md-primary)] shadow-sm" : "border-transparent hover:border-[var(--md-outline-variant)]"}`}
              style={{ backgroundColor: meta.bg }}
            >
              <p className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.icon} {meta.label}</p>
              <p className="text-[22px] font-bold mt-1" style={{ color: meta.color }}>{count.toLocaleString()}</p>
            </button>
          );
        })}
      </div>

      {/* ─── Filters ─── */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-4 flex flex-wrap items-center gap-3 md-elevation-1">
        <div className="relative flex-1 min-w-[200px]">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder="ค้นหาชื่อ, เบอร์, สินค้า, tracking..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className={`${inputCls} w-full pl-9`}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">×</button>
          )}
        </div>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className={inputCls} title="ตั้งแต่วันที่" />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className={inputCls} title="ถึงวันที่" />
        <select value={deliveryFilter} onChange={(e) => { setDeliveryFilter(e.target.value); setPage(0); }} className={inputCls}>
          <option value="">ทุกประเภทจัดส่ง</option>
          {Object.entries(deliveryLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {rewardFilter && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-primary-light)] text-[var(--md-primary)] text-[12px] font-medium">
            {rewardFilter.name}
            <button onClick={() => { setRewardFilter(null); setPage(0); }} className="hover:opacity-70">×</button>
          </span>
        )}
        {(search || dateFrom || dateTo || deliveryFilter || statusFilter || rewardFilter) && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setDateFrom(""); setDateTo(""); setDeliveryFilter(""); setStatusFilter(""); setRewardFilter(null); setPage(0); }}
            className="h-[36px] px-3 text-[12px] font-medium text-[var(--md-error)] hover:underline"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* ─── Table ─── */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" checked={txns.length > 0 && selectedIds.size === txns.length} onChange={toggleSelectAll} className="w-4 h-4 accent-[var(--md-primary)]" />
              </th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                <button className={thBtn} onClick={() => handleSort("reward_name")}>Reward<SortArrow col="reward_name" /></button>
              </th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                <button className={thBtn} onClick={() => handleSort("user_name")}>Customer<SortArrow col="user_name" /></button>
              </th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Delivery</th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                <button className={thBtn} onClick={() => handleSort("status")}>Status<SortArrow col="status" /></button>
              </th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                <button className={thBtn} onClick={() => handleSort("tracking")}>Tracking<SortArrow col="tracking" /></button>
              </th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                <button className={thBtn} onClick={() => handleSort("created_at")}>Date<SortArrow col="created_at" /></button>
              </th>
              <th className="text-right px-4 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-16 text-center text-[var(--md-on-surface-variant)]"><svg className="animate-spin w-6 h-6 mx-auto mb-2" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-[13px]">กำลังโหลด...</p></td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-16 text-center text-[var(--md-on-surface-variant)]"><p className="text-[15px] font-medium mb-1">ไม่พบรายการ</p><p className="text-[13px]">ลองเปลี่ยนตัวกรอง หรือค้นหาด้วยคำอื่น</p></td></tr>
            ) : txns.map((t) => {
              const meta = statusMeta[t.status] || statusMeta.PENDING;
              const actions = nextStatus[t.status] || [];
              const address = compactAddress(t);
              const isSelected = selectedIds.has(t.id);
              return (
                <Fragment key={t.id}>
                  <tr className={`border-b border-[var(--md-outline-variant)] hover:bg-[var(--md-surface-dim)] transition-colors ${isSelected ? "bg-[var(--md-primary-light)]/30" : ""}`}>
                    <td className="w-10 px-3 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)} className="w-4 h-4 accent-[var(--md-primary)]" />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setRewardFilter({ id: t.reward_id, name: t.reward_name || t.reward_id.slice(0, 8) }); setPage(0); }}
                        className="text-[13px] font-medium text-[var(--md-primary)] hover:underline text-left"
                        title="คลิกเพื่อ filter สินค้านี้"
                      >
                        {t.reward_name || t.reward_id.slice(0, 8)}
                      </button>
                      <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5 font-mono">#{t.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setCustomerPanel(customerPanel?.user_id === t.user_id ? null : t)}
                        className="text-[13px] font-medium text-[var(--md-primary)] hover:underline text-left flex items-center gap-1"
                        title="คลิกเพื่อดูรายละเอียดลูกค้า"
                      >
                        {t.user_name || `${t.user_id.slice(0, 8)}...`}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                      </button>
                      <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">{t.user_phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-medium text-[var(--md-on-surface)]">
                        {deliveryLabel[t.delivery_type || "none"] || (t.delivery_type || "—")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: meta.bg, color: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--md-on-surface-variant)] font-mono">{t.tracking || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-[var(--md-on-surface-variant)]">
                      {new Date(t.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                      <br />
                      <span className="text-[11px]">{new Date(t.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button
                          onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                          className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-on-surface)] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] transition-all"
                        >
                          {expandedId === t.id ? "ซ่อน" : "ดูเพิ่ม"}
                        </button>
                        {t.delivery_type === "shipping" && t.address_line1 && (
                          <button
                            onClick={() => { const popup = window.open("", "_blank", "width=900,height=700"); if (popup) { popup.document.write(buildLabelHTML([t])); popup.document.close(); popup.focus(); popup.print(); } }}
                            className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-primary)] bg-[var(--md-primary-light)] hover:opacity-80 transition-all"
                          >
                            🖨️
                          </button>
                        )}
                        {actions.map((a) => (
                          <button
                            key={a}
                            onClick={() => handleUpdateStatus(t.id, a)}
                            disabled={actionId === t.id}
                            className={`h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] transition-all disabled:opacity-50 ${
                              a === "CANCELLED"
                                ? "text-[var(--md-error)] bg-[var(--md-error-light)] hover:opacity-80"
                                : "text-[var(--md-primary)] bg-[var(--md-primary-light)] hover:opacity-80"
                            }`}
                          >
                            {a === "CONFIRMED" ? "ยืนยัน" : a === "SHIPPING" ? "จัดส่ง" : a === "SHIPPED" ? "ส่งแล้ว" : a === "COMPLETED" ? "สำเร็จ" : a === "CANCELLED" ? "ยกเลิก" : a}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded details */}
                  {expandedId === t.id && (
                    <tr className="border-b border-[var(--md-outline-variant)] bg-[var(--md-surface-dim)]/40">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-xl bg-white p-4">
                            <p className="text-[12px] font-semibold text-[var(--md-on-surface)] mb-3">ข้อมูลลูกค้า</p>
                            <div className="space-y-2 text-[13px]">
                              <p><span className="text-[var(--md-on-surface-variant)]">ชื่อสมาชิก:</span> {t.user_name || "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">เบอร์สมาชิก:</span> {t.user_phone || "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">User ID:</span> <span className="font-mono text-[11px]">{t.user_id}</span></p>
                            </div>
                          </div>
                          <div className="rounded-xl bg-white p-4">
                            <p className="text-[12px] font-semibold text-[var(--md-on-surface)] mb-3">ข้อมูลผู้รับ & ที่อยู่</p>
                            <div className="space-y-2 text-[13px]">
                              <p><span className="text-[var(--md-on-surface-variant)]">ผู้รับ:</span> {t.recipient_name || "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">เบอร์ผู้รับ:</span> {t.recipient_phone || "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">ที่อยู่:</span> {address || "-"}</p>
                            </div>
                          </div>
                          <div className="rounded-xl bg-white p-4">
                            <p className="text-[12px] font-semibold text-[var(--md-on-surface)] mb-3">รายละเอียดเพิ่มเติม</p>
                            <div className="space-y-2 text-[13px]">
                              <p><span className="text-[var(--md-on-surface-variant)]">ประเภทจัดส่ง:</span> {deliveryLabel[t.delivery_type || "none"] || "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">Tracking:</span> {t.tracking || "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">คูปอง:</span> {t.coupon_code || "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">ยืนยันเมื่อ:</span> {t.confirmed_at ? new Date(t.confirmed_at).toLocaleString("th-TH") : "-"}</p>
                              <p><span className="text-[var(--md-on-surface-variant)]">Reward ID:</span> <span className="font-mono text-[11px]">{t.reward_id}</span></p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--md-outline-variant)]">
            <p className="text-[12px] text-[var(--md-on-surface-variant)]">
              แสดง {page * limit + 1}-{Math.min((page + 1) * limit, total)} จาก {total.toLocaleString()} รายการ
            </p>
            <div className="flex items-center gap-1.5">
              <button disabled={page === 0} onClick={() => setPage(0)} className="h-[30px] px-2 text-[12px] text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] disabled:opacity-40 hover:bg-[var(--md-surface-container-high)] transition-all">⟨⟨</button>
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-[30px] px-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] disabled:opacity-40 hover:bg-[var(--md-surface-container-high)] transition-all">ก่อนหน้า</button>
              <span className="px-3 text-[12px] text-[var(--md-on-surface-variant)]">{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-[30px] px-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] disabled:opacity-40 hover:bg-[var(--md-surface-container-high)] transition-all">ถัดไป</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-[30px] px-2 text-[12px] text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] disabled:opacity-40 hover:bg-[var(--md-surface-container-high)] transition-all">⟩⟩</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Customer Detail Panel (Slide-over) ─── */}
      {customerPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCustomerPanel(null)} />
          <div className="relative w-full max-w-md bg-[var(--md-surface)] shadow-2xl overflow-y-auto animate-in slide-in-from-right">
            <div className="sticky top-0 bg-[var(--md-surface)] z-10 p-5 border-b border-[var(--md-outline-variant)] flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-[var(--md-on-surface)]">ข้อมูลลูกค้า</h2>
              <button onClick={() => setCustomerPanel(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--md-surface-container)] transition-colors text-[var(--md-on-surface-variant)]">✕</button>
            </div>
            <div className="p-5 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[var(--md-primary-light)] flex items-center justify-center text-[var(--md-primary)] text-[20px] font-bold">
                  {(customerPanel.user_name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-[var(--md-on-surface)]">{customerPanel.user_name || "ไม่ทราบชื่อ"}</p>
                  <p className="text-[13px] text-[var(--md-on-surface-variant)]">{customerPanel.user_phone || "ไม่พบเบอร์"}</p>
                </div>
              </div>
              <div className="rounded-xl bg-[var(--md-surface-container)] p-4 space-y-3">
                <p className="text-[12px] font-semibold text-[var(--md-on-surface)]">ข้อมูลสมาชิก</p>
                <div className="space-y-2 text-[13px]">
                  <p><span className="text-[var(--md-on-surface-variant)]">User ID:</span> <span className="font-mono text-[11px]">{customerPanel.user_id}</span></p>
                  <p><span className="text-[var(--md-on-surface-variant)]">เบอร์โทร:</span> {customerPanel.user_phone || "-"}</p>
                </div>
              </div>
              <div className="rounded-xl bg-[var(--md-surface-container)] p-4 space-y-3">
                <p className="text-[12px] font-semibold text-[var(--md-on-surface)]">ที่อยู่จัดส่ง (จากรายการนี้)</p>
                <div className="space-y-2 text-[13px]">
                  <p><span className="text-[var(--md-on-surface-variant)]">ผู้รับ:</span> {customerPanel.recipient_name || "-"}</p>
                  <p><span className="text-[var(--md-on-surface-variant)]">เบอร์ผู้รับ:</span> {customerPanel.recipient_phone || "-"}</p>
                  <p><span className="text-[var(--md-on-surface-variant)]">ที่อยู่:</span> {compactAddress(customerPanel) || "-"}</p>
                </div>
              </div>
              <div className="rounded-xl bg-[var(--md-surface-container)] p-4 space-y-3">
                <p className="text-[12px] font-semibold text-[var(--md-on-surface)]">ประวัติการแลก (ลูกค้านี้)</p>
                <div className="space-y-2">
                  {txns.filter((tx) => tx.user_id === customerPanel.user_id).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-[12px] p-2 rounded-lg bg-white">
                      <div>
                        <p className="font-medium text-[var(--md-on-surface)]">{tx.reward_name || tx.reward_id.slice(0, 8)}</p>
                        <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">{new Date(tx.created_at).toLocaleDateString("th-TH")}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: (statusMeta[tx.status] || statusMeta.PENDING).bg, color: (statusMeta[tx.status] || statusMeta.PENDING).color }}>
                        {(statusMeta[tx.status] || statusMeta.PENDING).label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
