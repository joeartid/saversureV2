"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface Reward {
  id: string;
  name: string;
  description: string;
  type: string;
  point_cost: number;
  normal_point_cost: number;
  price: number;
  cost_currency: string;
  image_url: string | null;
  delivery_type: string;
  status: string;
  valid_from: string | null;
  expires_at: string | null;
  total_qty: number;
  reserved_qty: number;
  sold_qty: number;
  available_qty: number;
  created_at: string;
}

interface CurrencyMaster {
  id: string;
  code: string;
  name: string;
  icon: string;
  is_default: boolean;
  active: boolean;
}

const typeOptions = [
  { value: "product", label: "สินค้าจริง" },
  { value: "premium", label: "สินค้าพรีเมียม" },
  { value: "coupon", label: "คูปอง" },
  { value: "digital", label: "ดิจิทัล" },
  { value: "ticket", label: "ตั๋ว" },
];

const deliveryOptions = [
  { value: "none", label: "ไม่ระบุ" },
  { value: "shipping", label: "📦 จัดส่ง" },
  { value: "coupon", label: "🎫 คูปอง" },
  { value: "pickup", label: "📍 รับหน้าร้าน" },
  { value: "digital", label: "📱 ดิจิทัล" },
  { value: "ticket", label: "🎟️ ตั๋ว/บัตร" },
];

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green-100 text-green-700" },
  inactive: { label: "Inactive", cls: "bg-gray-200 text-gray-600" },
  draft: { label: "Draft", cls: "bg-amber-100 text-amber-700" },
};

const currencyFallbackEmoji: Record<string, string> = { point: "🪙", diamond: "💎", ticket: "🎟️" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
const mediaUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}/media/${url}`;
};

const fieldClass = "w-full h-[44px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";
const labelClass = "block text-[11px] font-semibold text-[var(--md-on-surface-variant)] mb-1 tracking-[0.5px] uppercase";

type FormData = {
  campaign_id: string;
  name: string;
  description: string;
  type: string;
  point_cost: number;
  normal_point_cost: number;
  price: number;
  cost_currency: string;
  delivery_type: string;
  status: string;
  valid_from: string;
  expires_at: string;
  total_qty: number;
  image_url: string;
};

const emptyForm: FormData = {
  campaign_id: "", name: "", description: "", type: "product",
  point_cost: 100, normal_point_cost: 0, price: 0, cost_currency: "point", delivery_type: "none",
  status: "active", valid_from: "", expires_at: "", total_qty: 100, image_url: "",
};

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inventoryModal, setInventoryModal] = useState<{ id: string; name: string; delta: number } | null>(null);
  const [updatingInv, setUpdatingInv] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "draft">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const getCurrencyIcon = (code: string) => {
    const c = currencies.find((x) => x.code.toLowerCase() === code.toLowerCase());
    return c?.icon || currencyFallbackEmoji[code.toLowerCase()] || "⭐";
  };

  const getCurrencyName = (code: string) => {
    const c = currencies.find((x) => x.code.toLowerCase() === code.toLowerCase());
    return c?.name || code;
  };

  const fetchRewards = useCallback(async () => {
    try {
      const data = await api.get<{ data: Reward[] }>("/api/v1/rewards");
      setRewards(data.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchRewards();
    api.get<{ data: CurrencyMaster[] }>("/api/v1/currencies")
      .then((d) => setCurrencies(d.data || []))
      .catch(() => {});
  }, [fetchRewards]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (r: Reward) => {
    setEditId(r.id);
    setForm({
      campaign_id: "",
      name: r.name,
      description: r.description,
      type: r.type,
      point_cost: r.point_cost,
      normal_point_cost: r.normal_point_cost,
      price: r.price,
      cost_currency: r.cost_currency,
      delivery_type: r.delivery_type,
      status: r.status,
      valid_from: r.valid_from ? r.valid_from.replace(' ', 'T').slice(0, 16) : "",
      expires_at: r.expires_at ? r.expires_at.replace(' ', 'T').slice(0, 16) : "",
      total_qty: r.total_qty,
      image_url: r.image_url || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        await api.patch(`/api/v1/rewards/${editId}`, {
          name: form.name || undefined,
          description: form.description || undefined,
          type: form.type || undefined,
          point_cost: form.point_cost,
          normal_point_cost: form.normal_point_cost,
          price: form.price,
          cost_currency: form.cost_currency || undefined,
          delivery_type: form.delivery_type || undefined,
          status: form.status || undefined,
          valid_from: form.valid_from || "__clear__",
          expires_at: form.expires_at || "__clear__",
          image_url: form.image_url === "" ? "__clear__" : (form.image_url || undefined),
        });
      } else {
        await api.post("/api/v1/rewards", {
          ...form,
          valid_from: form.valid_from || null,
          expires_at: form.expires_at || null,
          image_url: form.image_url || null,
        });
      }
      setShowForm(false);
      setEditId(null);
      setForm({ ...emptyForm });
      fetchRewards();
    } catch { toast.error("Failed to save reward"); } finally { setSubmitting(false); }
  };

  const handleUpdateInventory = async () => {
    if (!inventoryModal) return;
    setUpdatingInv(true);
    try {
      await api.patch(`/api/v1/rewards/${inventoryModal.id}/inventory`, { total_qty: inventoryModal.delta });
      setInventoryModal(null);
      fetchRewards();
    } catch { toast.error("Failed to update inventory"); } finally { setUpdatingInv(false); }
  };

  const toggleStatus = async (r: Reward) => {
    const newStatus = r.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/api/v1/rewards/${r.id}`, { status: newStatus });
      fetchRewards();
    } catch { toast.error("Failed to update status"); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.upload("/api/v1/upload/image", file);
      setForm({ ...form, image_url: result.url });
    } catch { toast.error("Upload failed"); } finally { 
      setUploading(false);
      e.target.value = ""; // Reset input so same file can be uploaded again if needed
    }
  };

  const filtered = rewards.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Rewards & Inventory</h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            จัดการของรางวัล ราคา สกุลเงิน สถานะ และ stock
          </p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] active:scale-[0.98] transition-all">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
          Add Reward
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-[360px]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--md-on-surface-variant)] opacity-60 pointer-events-none">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารางวัล..."
            className="w-full h-[40px] pl-9 pr-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all placeholder:text-[var(--md-on-surface-variant)] placeholder:opacity-60"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-[40px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all cursor-pointer"
        >
          <option value="all">ทุกหมวดหมู่ ({rewards.length})</option>
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} ({rewards.filter((r) => r.type === o.value).length})
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-[40px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all cursor-pointer"
        >
          <option value="all">ทั้งหมด ({rewards.length})</option>
          <option value="active">Active ({rewards.filter((r) => r.status === "active").length})</option>
          <option value="inactive">Inactive ({rewards.filter((r) => r.status === "inactive").length})</option>
          <option value="draft">Draft ({rewards.filter((r) => r.status === "draft").length})</option>
        </select>
        {(search || statusFilter !== "all" || typeFilter !== "all") && (
          <span className="text-[12px] text-[var(--md-on-surface-variant)]">
            {filtered.length} รายการ
          </span>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 overflow-y-auto py-8" onClick={() => { setShowForm(false); setEditId(null); }}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-3 p-6 w-full max-w-[640px] mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-5">{editId ? "แก้ไขรางวัล" : "เพิ่มรางวัลใหม่"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image */}
              <div>
                <label className={labelClass}>รูปสินค้า</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-[var(--md-radius-md)] border border-dashed border-[var(--md-outline)] overflow-hidden bg-[var(--md-surface-container)] flex items-center justify-center">
                    {form.image_url ? (
                      <Image src={mediaUrl(form.image_url) || ""} alt="" width={80} height={80} className="w-full h-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[var(--md-on-surface-variant)] opacity-30"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="reward-img" />
                    <label htmlFor="reward-img" className={`inline-flex items-center gap-2 h-[36px] px-4 bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] rounded-[var(--md-radius-sm)] text-[13px] font-medium cursor-pointer hover:bg-[var(--md-surface-container-high)] transition-all ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploading ? "Uploading..." : "📷 เลือกรูป"}
                    </label>
                    {form.image_url && (
                      <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="ml-2 text-[12px] text-red-500 hover:underline">ลบรูป</button>
                    )}
                    <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">หรือวาง URL รูปภาพ:</p>
                    <input type="text" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className={`${fieldClass} h-[36px] mt-1 text-[12px]`} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editId && (
                  <div className="col-span-2">
                    <label className={labelClass}>Campaign ID</label>
                    <input type="text" value={form.campaign_id} onChange={(e) => setForm({ ...form, campaign_id: e.target.value })} required className={fieldClass} />
                  </div>
                )}
                <div className="col-span-2">
                  <label className={labelClass}>ชื่อรางวัล</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required={!editId} className={fieldClass} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>รายละเอียด</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={`${fieldClass} h-auto py-2`} />
                </div>
                <div>
                  <label className={labelClass}>ราคาเต็ม (บาท)</label>
                  <input type="number" value={form.price === 0 ? 0 : (form.price || "")} onChange={(e) => setForm({ ...form, price: e.target.value === "" ? 0 : parseFloat(e.target.value) })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>แต้มปกติ (ก่อนลด)</label>
                  <input type="number" value={form.normal_point_cost === 0 ? 0 : (form.normal_point_cost || "")} onChange={(e) => setForm({ ...form, normal_point_cost: e.target.value === "" ? 0 : parseInt(e.target.value) })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>แต้มลดราคา (แต้มที่ใช้จริง)</label>
                  <input type="number" value={form.point_cost === 0 ? 0 : (form.point_cost || "")} onChange={(e) => setForm({ ...form, point_cost: e.target.value === "" ? 0 : parseInt(e.target.value) })} min={1} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>สกุลเงิน</label>
                  <select value={form.cost_currency} onChange={(e) => setForm({ ...form, cost_currency: e.target.value })} className={fieldClass}>
                      {currencies.length > 0
                      ? currencies.filter((c) => c.active).map((c) => (
                          <option key={c.code} value={c.code.toLowerCase()}>
                            {c.icon} {c.name} ({c.code})
                          </option>
                        ))
                      : <option value="point">🪙 Point</option>
                    }
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ประเภทสินค้า</label>
                  <select value={form.type} onChange={(e) => {
                    const t = e.target.value;
                    const autoDelivery: Record<string, string> = { product: "shipping", premium: "shipping", coupon: "coupon", digital: "digital", ticket: "ticket" };
                    setForm({ ...form, type: t, delivery_type: autoDelivery[t] || form.delivery_type });
                  }} className={fieldClass}>
                    {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>วิธีจัดส่ง</label>
                  <select value={form.delivery_type} onChange={(e) => setForm({ ...form, delivery_type: e.target.value })} className={fieldClass}>
                    {deliveryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>สถานะ</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fieldClass}>
                    <option value="active">✅ Active</option>
                    <option value="inactive">⏸️ Inactive</option>
                    <option value="draft">📝 Draft</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>วันเริ่มต้น</label>
                  <input type="datetime-local" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>วันหมดอายุ</label>
                  <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className={fieldClass} />
                </div>
                {!editId && (
                  <div>
                    <label className={labelClass}>จำนวน Stock เริ่มต้น</label>
                    <input type="number" value={form.total_qty} onChange={(e) => setForm({ ...form, total_qty: parseInt(e.target.value) || 1 })} min={1} required className={fieldClass} />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1 h-[40px] text-[14px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] hover:bg-[var(--md-surface-container-high)] transition-all">
                  ยกเลิก
                </button>
                <button type="submit" disabled={submitting} className="flex-1 h-[40px] text-[14px] font-medium text-white bg-[var(--md-primary)] rounded-[var(--md-radius-xl)] hover:bg-[var(--md-primary-dark)] disabled:opacity-60 transition-all">
                  {submitting ? "Saving..." : editId ? "บันทึกการแก้ไข" : "สร้างรางวัล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {inventoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setInventoryModal(null)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-3 p-6 w-full max-w-[400px] mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-1">อัพเดท Stock</h3>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-5">{inventoryModal.name}</p>
            <div>
              <label className={labelClass}>จำนวน Total ใหม่</label>
              <input type="number" value={inventoryModal.delta} onChange={(e) => setInventoryModal({ ...inventoryModal, delta: parseInt(e.target.value) || 0 })} className="w-full h-[56px] px-5 border border-[var(--md-outline)] rounded-[var(--md-radius-md)] text-[20px] font-mono text-[var(--md-on-surface)] bg-transparent outline-none text-center focus:border-[var(--md-primary)] focus:border-2 transition-all" autoFocus />
              <div className="flex gap-2 mt-3 justify-center">
                {[50, 100, 200, 500, 1000].map((n) => (
                  <button key={n} type="button" onClick={() => setInventoryModal({ ...inventoryModal, delta: n })} className="h-[32px] px-3 text-[12px] font-medium text-[var(--md-primary)] bg-[var(--md-primary-light)] rounded-[var(--md-radius-sm)] hover:opacity-80 transition-all">
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setInventoryModal(null)} className="flex-1 h-[40px] text-[14px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] hover:bg-[var(--md-surface-container-high)] transition-all">
                ยกเลิก
              </button>
              <button onClick={handleUpdateInventory} disabled={updatingInv || !inventoryModal.delta} className="flex-1 h-[40px] text-[14px] font-medium text-white bg-[var(--md-primary)] rounded-[var(--md-radius-xl)] hover:bg-[var(--md-primary-dark)] disabled:opacity-60 transition-all">
                {updatingInv ? "Updating..." : "อัพเดท"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase w-14" />
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase">รางวัล</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase">ประเภท</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase">ราคา</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase">สถานะ</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase">หมดอายุ</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase">Stock</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--md-on-surface-variant)] tracking-[0.5px] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center"><div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]"><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading...</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-[var(--md-on-surface-variant)]">No rewards found</td></tr>
            ) : (
              filtered.map((r) => {
                const pct = r.total_qty > 0 ? Math.round((r.available_qty / r.total_qty) * 100) : 0;
                const badge = statusBadge[r.status] || statusBadge.active;
                const emoji = getCurrencyIcon(r.cost_currency);
                const isExpired = r.expires_at && new Date(r.expires_at) < new Date();
                const imgSrc = mediaUrl(r.image_url);

                return (
                  <tr key={r.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors">
                    {/* Thumbnail */}
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-[var(--md-radius-sm)] overflow-hidden bg-[var(--md-surface-container)] flex items-center justify-center">
                        {imgSrc ? (
                          <Image src={imgSrc} alt="" width={40} height={40} className="w-full h-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-on-surface-variant)] opacity-30"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
                        )}
                      </div>
                    </td>
                    {/* Name + delivery */}
                    <td className="px-4 py-3">
                      <p className="text-[14px] font-medium text-[var(--md-on-surface)] leading-tight">{r.name}</p>
                      {r.delivery_type !== "none" && (
                        <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">
                          {deliveryOptions.find((o) => o.value === r.delivery_type)?.label || r.delivery_type}
                        </p>
                      )}
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-[var(--md-radius-sm)] text-[11px] font-medium bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] capitalize">{r.type}</span>
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-[14px] font-bold text-[var(--md-on-surface)]">
                        {emoji} {r.point_cost.toLocaleString()}
                      </span>
                      <p className="text-[10px] text-[var(--md-on-surface-variant)]">{r.cost_currency}</p>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleStatus(r)} className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all hover:opacity-80 ${badge.cls}`}>
                        {badge.label}
                      </button>
                    </td>
                    {/* Expiry */}
                    <td className="px-4 py-3 text-center">
                      {r.expires_at ? (
                        <span className={`text-[12px] ${isExpired ? "text-red-500 font-bold" : "text-[var(--md-on-surface-variant)]"}`}>
                          {isExpired ? "❌ หมดอายุ" : new Date(r.expires_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--md-on-surface-variant)]">ไม่กำหนด</span>
                      )}
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[14px] font-bold text-[var(--md-primary)]">{r.available_qty.toLocaleString()}</span>
                        <div className="w-16 h-1.5 bg-[var(--md-surface-container)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--md-primary)] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--md-on-surface-variant)]">{r.available_qty}/{r.total_qty}</span>
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openEdit(r)} className="h-[28px] px-2.5 text-[11px] font-medium text-[var(--md-primary)] bg-[var(--md-primary-light)] rounded-[var(--md-radius-sm)] hover:opacity-80 transition-all">
                          ✏️ แก้ไข
                        </button>
                        <button onClick={() => setInventoryModal({ id: r.id, name: r.name, delta: r.total_qty })} className="h-[28px] px-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] hover:opacity-80 transition-all">
                          📦 Stock
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
