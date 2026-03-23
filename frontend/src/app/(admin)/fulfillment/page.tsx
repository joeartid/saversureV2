"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface FulfillmentItem {
  id: string;
  reward_id: string;
  reward_name: string | null;
  user_id: string;
  user_name: string | null;
  user_phone: string | null;
  fulfillment_status: string;
  tracking_number: string | null;
  delivery_type: string | null;
  coupon_code: string | null;
  address_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  district: string | null;
  sub_district: string | null;
  province: string | null;
  postal_code: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  confirmed_at: string | null;
}

interface FulfillmentListResponse {
  data: FulfillmentItem[];
  total: number;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "รอจัดการ", color: "#b26a00", bg: "#fff3e0" },
  preparing: { label: "กำลังเตรียม", color: "#1565c0", bg: "#e3f2fd" },
  shipped: { label: "จัดส่งแล้ว", color: "#2e7d32", bg: "#e8f5e9" },
  delivered: { label: "ส่งสำเร็จ", color: "#1b5e20", bg: "#dff3e3" },
};

const STATUS_OPTIONS = ["pending", "preparing", "shipped", "delivered"] as const;

const DELIVERY_LABEL: Record<string, string> = {
  shipping: "จัดส่ง",
  coupon: "คูปอง",
  digital: "ดิจิทัล",
  pickup: "รับหน้าร้าน",
  ticket: "ตั๋ว",
  none: "ไม่ระบุ",
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(item: FulfillmentItem) {
  return [
    item.address_line1,
    item.address_line2,
    item.sub_district,
    item.district,
    item.province,
    item.postal_code,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildLabelHTML(items: FulfillmentItem[]) {
  const printedAt = new Date().toLocaleString("th-TH");
  const pages = items.map((item) => {
    const address = formatAddress(item);
    return `
      <section class="sheet">
        <div class="header">
          <div>
            <div class="title">ใบปะหน้าจัดส่ง</div>
            <div class="subtitle">Saversure Fulfillment</div>
          </div>
          <div class="pill">${item.fulfillment_status}</div>
        </div>
        <div class="grid">
          <div class="label">รางวัล</div><div class="value">${item.reward_name || "-"}</div>
          <div class="label">เลขรายการ</div><div class="value">${item.id}</div>
          <div class="label">ผู้รับ</div><div class="value">${item.recipient_name || item.user_name || "-"}</div>
          <div class="label">เบอร์โทร</div><div class="value">${item.recipient_phone || item.user_phone || "-"}</div>
          <div class="label">ที่อยู่</div><div class="value">${address || "-"}</div>
          <div class="label">Tracking</div><div class="value">${item.tracking_number || "-"}</div>
        </div>
        <div class="footer">พิมพ์เมื่อ ${printedAt}</div>
      </section>
    `;
  });

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Fulfillment Labels</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111827; }
        .sheet { border: 2px solid #111827; border-radius: 16px; padding: 24px; margin: 0 auto 24px; max-width: 720px; page-break-after: always; }
        .sheet:last-child { page-break-after: auto; }
        .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
        .title { font-size: 28px; font-weight: 700; }
        .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
        .pill { background: #e8f0fe; color: #1a73e8; border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 160px 1fr; gap: 12px 16px; margin-top: 24px; }
        .label { font-weight: 700; color: #4b5563; }
        .value { white-space: pre-wrap; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>${pages.join("")}</body>
  </html>`;
}

export default function FulfillmentPage() {
  const [items, setItems] = useState<FulfillmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const limit = 30;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get<FulfillmentListResponse>(`/api/v1/fulfillment?${params.toString()}`);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [items]);

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [
        item.reward_name,
        item.user_name,
        item.user_phone,
        item.recipient_name,
        item.recipient_phone,
        item.tracking_number,
        item.coupon_code,
        formatAddress(item),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [items, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.fulfillment_status] = (counts[item.fulfillment_status] || 0) + 1;
    }
    return counts;
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = visibleItems.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const askTrackingIfNeeded = (status: string) => {
    if (status !== "shipped") return undefined;
    const tracking = window.prompt("กรอกเลข Tracking ได้เลย ถ้ายังไม่มีให้ปล่อยว่าง");
    if (tracking === null) return null;
    const trimmed = tracking.trim();
    return trimmed || undefined;
  };

  const updateSingleStatus = async (id: string, status: string) => {
    const tracking = askTrackingIfNeeded(status);
    if (tracking === null) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/v1/fulfillment/${id}`, {
        fulfillment_status: status,
        tracking_number: tracking,
      });
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedIds.size === 0) {
      alert("เลือกรายการก่อน");
      return;
    }
    const tracking = askTrackingIfNeeded(status);
    if (tracking === null) return;
    setActionLoading(true);
    try {
      await api.post("/api/v1/fulfillment/bulk-update", {
        ids: Array.from(selectedIds),
        fulfillment_status: status,
        tracking_number: tracking,
      });
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "อัปเดตรายการไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  };

  const printSelected = () => {
    const selected = items.filter(
      (item) => selectedIds.has(item.id) && item.delivery_type === "shipping" && item.address_line1
    );
    if (selected.length === 0) {
      alert("เลือกรายการที่เป็นงานจัดส่งและมีที่อยู่ก่อน");
      return;
    }
    const popup = window.open("", "_blank", "width=960,height=720");
    if (!popup) return;
    popup.document.write(buildLabelHTML(selected));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const downloadPDF = async () => {
    if (selectedIds.size === 0) {
      alert("เลือกรายการก่อน");
      return;
    }
    try {
      await api.download("/api/v1/fulfillment/export-pdf", "delivery-notes.pdf", {
        method: "POST",
        body: { ids: Array.from(selectedIds) },
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "ดาวน์โหลด PDF ไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Fulfillment</h1>
          <p className="mt-1 text-[14px] text-[var(--md-on-surface-variant)]">
            ดูรายการหลังแลกรางวัล จัดส่งต่อ และปิดสถานะงาน
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => void bulkUpdateStatus("preparing")}
                disabled={actionLoading}
                className="h-[36px] rounded-[var(--md-radius-sm)] bg-[#e3f2fd] px-4 text-[13px] font-medium text-[#1565c0] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                เปลี่ยนเป็นกำลังเตรียม
              </button>
              <button
                onClick={() => void bulkUpdateStatus("shipped")}
                disabled={actionLoading}
                className="h-[36px] rounded-[var(--md-radius-sm)] bg-[#e8f5e9] px-4 text-[13px] font-medium text-[#2e7d32] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                เปลี่ยนเป็นจัดส่งแล้ว
              </button>
              <button
                onClick={printSelected}
                className="h-[36px] rounded-[var(--md-radius-sm)] bg-[var(--md-primary)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                พิมพ์ใบปะหน้า ({selectedIds.size})
              </button>
              <button
                onClick={() => void downloadPDF()}
                className="h-[36px] rounded-[var(--md-radius-sm)] bg-[#5d4037] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                ดาวน์โหลด PDF
              </button>
            </>
          )}
          <button
            onClick={() => void fetchData()}
            className="h-[36px] rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] px-4 text-[13px] font-medium text-[var(--md-on-surface)] transition-colors hover:bg-[var(--md-surface-container-high)]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <button
          onClick={() => {
            setStatusFilter("");
            setPage(0);
          }}
          className={`rounded-xl border-2 bg-[var(--md-surface)] p-4 text-left transition-all ${
            !statusFilter ? "border-[var(--md-primary)] shadow-sm" : "border-transparent hover:border-[var(--md-outline-variant)]"
          }`}
        >
          <p className="text-[11px] font-medium text-[var(--md-on-surface-variant)]">ทั้งหมด</p>
          <p className="mt-1 text-[24px] font-bold text-[var(--md-on-surface)]">{total.toLocaleString()}</p>
        </button>
        {STATUS_OPTIONS.map((status) => {
          const meta = STATUS_META[status];
          return (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(statusFilter === status ? "" : status);
                setPage(0);
              }}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                statusFilter === status ? "border-[var(--md-primary)] shadow-sm" : "border-transparent hover:border-[var(--md-outline-variant)]"
              }`}
              style={{ backgroundColor: meta.bg }}
            >
              <p className="text-[11px] font-medium" style={{ color: meta.color }}>
                {meta.label}
              </p>
              <p className="mt-1 text-[24px] font-bold" style={{ color: meta.color }}>
                {(statusCounts[status] || 0).toLocaleString()}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--md-radius-lg)] bg-[var(--md-surface)] p-4 md:flex-row md:items-center md:justify-between md-elevation-1">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อผู้รับ, เบอร์, รางวัล, tracking..."
          className="h-[40px] min-w-[240px] flex-1 rounded-[var(--md-radius-sm)] border border-[var(--md-outline-variant)] bg-transparent px-3 text-[13px] text-[var(--md-on-surface)] outline-none transition-colors focus:border-[var(--md-primary)]"
        />
        <div className="text-[13px] text-[var(--md-on-surface-variant)]">
          แสดง {visibleItems.length.toLocaleString()} จาก {items.length.toLocaleString()} รายการในหน้านี้
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--md-radius-lg)] bg-[var(--md-surface)] md-elevation-1">
        <table className="w-full min-w-[1280px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id))}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4 accent-[var(--md-primary)]"
                />
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">รางวัล</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">ผู้รับ</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">จัดส่ง</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">สถานะ</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">Tracking</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">ยืนยันเมื่อ</th>
              <th className="px-4 py-3 text-right text-[12px] font-medium uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center text-[13px] text-[var(--md-on-surface-variant)]">
                  กำลังโหลดรายการ...
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center text-[13px] text-[var(--md-on-surface-variant)]">
                  ไม่พบรายการที่ตรงกับเงื่อนไข
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => {
                const meta = STATUS_META[item.fulfillment_status] || STATUS_META.pending;
                const address = formatAddress(item);
                return (
                  <tr key={item.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0">
                    <td className="px-3 py-4 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 accent-[var(--md-primary)]"
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-[14px] font-medium text-[var(--md-on-surface)]">{item.reward_name || "-"}</div>
                      <div className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">{item.id}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-[14px] font-medium text-[var(--md-on-surface)]">
                        {item.recipient_name || item.user_name || "-"}
                      </div>
                      <div className="mt-1 text-[12px] text-[var(--md-on-surface-variant)]">
                        {item.recipient_phone || item.user_phone || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-[13px] text-[var(--md-on-surface)]">
                        {DELIVERY_LABEL[item.delivery_type || "none"] || item.delivery_type || "-"}
                      </div>
                      <div className="mt-1 max-w-[280px] text-[12px] text-[var(--md-on-surface-variant)]">{address || "-"}</div>
                      {item.coupon_code && (
                        <div className="mt-2 inline-flex rounded-full bg-[#fef7e0] px-2.5 py-1 text-[11px] font-medium text-[#b26a00]">
                          Coupon: {item.coupon_code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-[12px] font-medium"
                        style={{ color: meta.color, backgroundColor: meta.bg }}
                      >
                        {meta.label}
                      </span>
                      {item.shipped_at && (
                        <div className="mt-2 text-[11px] text-[var(--md-on-surface-variant)]">
                          ส่งเมื่อ {formatDateTime(item.shipped_at)}
                        </div>
                      )}
                      {item.delivered_at && (
                        <div className="mt-1 text-[11px] text-[var(--md-on-surface-variant)]">
                          ปิดงานเมื่อ {formatDateTime(item.delivered_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-[13px] text-[var(--md-on-surface)]">
                      {item.tracking_number || "-"}
                    </td>
                    <td className="px-4 py-4 align-top text-[13px] text-[var(--md-on-surface)]">
                      {formatDateTime(item.confirmed_at || item.created_at)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {item.fulfillment_status === "pending" && (
                          <button
                            onClick={() => void updateSingleStatus(item.id, "preparing")}
                            disabled={actionLoading}
                            className="rounded-[var(--md-radius-sm)] bg-[#e3f2fd] px-3 py-2 text-[12px] font-medium text-[#1565c0] transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            เตรียมสินค้า
                          </button>
                        )}
                        {(item.fulfillment_status === "pending" || item.fulfillment_status === "preparing") && item.delivery_type === "shipping" && (
                          <button
                            onClick={() => void updateSingleStatus(item.id, "shipped")}
                            disabled={actionLoading}
                            className="rounded-[var(--md-radius-sm)] bg-[#e8f5e9] px-3 py-2 text-[12px] font-medium text-[#2e7d32] transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            ใส่ Tracking / จัดส่ง
                          </button>
                        )}
                        {(item.fulfillment_status === "pending" || item.fulfillment_status === "preparing" || item.fulfillment_status === "shipped") && (
                          <button
                            onClick={() => void updateSingleStatus(item.id, "delivered")}
                            disabled={actionLoading}
                            className="rounded-[var(--md-radius-sm)] bg-[#dff3e3] px-3 py-2 text-[12px] font-medium text-[#1b5e20] transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            ปิดงาน
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[13px] text-[var(--md-on-surface-variant)]">
          หน้า {page + 1} / {totalPages} , รวมทั้งหมด {total.toLocaleString()} รายการ
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0}
            className="h-[36px] rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] px-4 text-[13px] font-medium text-[var(--md-on-surface)] transition-colors hover:bg-[var(--md-surface-container-high)] disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <button
            onClick={() => setPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))}
            disabled={page + 1 >= totalPages}
            className="h-[36px] rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] px-4 text-[13px] font-medium text-[var(--md-on-surface)] transition-colors hover:bg-[var(--md-surface-container-high)] disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}
