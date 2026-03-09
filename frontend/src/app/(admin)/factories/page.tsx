"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Factory {
  id: string;
  name: string;
  code: string | null;
  factory_type: string;
  export_format: number;
  codes_per_roll: number;
  rolls_per_file: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  status: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  points_per_scan: number;
  status: string;
  assigned_at?: string;
}

const factoryTypeLabels: Record<string, string> = {
  general: "ทั่วไป",
  sticker_printer: "โรงพิมพ์สติ๊กเกอร์",
  applicator: "โรงงานแปะสติ๊กเกอร์",
};

const factoryTypeBadge: Record<string, string> = {
  general: "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]",
  sticker_printer: "bg-blue-100 text-blue-700",
  applicator: "bg-purple-100 text-purple-700",
};

const exportFormatLabels: Record<number, string> = {
  1: "Format 1 — Flat CSV",
  2: "Format 2 — Multi 4 Columns",
  3: "Format 3 — Multi N Columns (ถาวร)",
  4: "Format 4 — Single Column (No Header)",
};

export default function FactoriesPage() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Product assignment panel
  const [productPanelFactory, setProductPanelFactory] = useState<Factory | null>(null);
  const [assignedProducts, setAssignedProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [productPanelLoading, setProductPanelLoading] = useState(false);

  const emptyForm = {
    name: "",
    code: "",
    factory_type: "general",
    export_format: 1,
    codes_per_roll: 10000,
    rolls_per_file: 4,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    address: "",
  };
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Factory[]; total: number }>("/api/v1/factories");
      setFactories(data.data || []);
      setTotal(data.total || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/api/v1/factories/${editId}`, form);
      } else {
        await api.post("/api/v1/factories", form);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      alert(msg);
    }
  };

  const handleEdit = (f: Factory) => {
    setForm({
      name: f.name,
      code: f.code || "",
      factory_type: f.factory_type || "general",
      export_format: f.export_format || 1,
      codes_per_roll: f.codes_per_roll || 10000,
      rolls_per_file: f.rolls_per_file || 4,
      contact_name: f.contact_name || "",
      contact_phone: f.contact_phone || "",
      contact_email: f.contact_email || "",
      address: f.address || "",
    });
    setEditId(f.id);
    setShowForm(true);
    setProductPanelFactory(null);
  };

  const handleToggleStatus = async (f: Factory) => {
    const newStatus = f.status === "active" ? "inactive" : "active";
    setActionId(f.id);
    try {
      await api.patch(`/api/v1/factories/${f.id}`, { status: newStatus });
      fetchData();
    } catch {
      alert("Failed");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this factory?")) return;
    setActionId(id);
    try {
      await api.delete(`/api/v1/factories/${id}`);
      fetchData();
    } catch {
      alert("Failed to delete");
    } finally {
      setActionId(null);
    }
  };

  // ---- Product Panel ----

  const openProductPanel = async (f: Factory) => {
    setProductPanelFactory(f);
    setShowForm(false);
    setProductSearch("");
    setProductPanelLoading(true);
    try {
      const [assigned, allRes] = await Promise.all([
        api.get<{ data: Product[] }>(`/api/v1/factories/${f.id}/products`),
        api.get<{ data: Product[] }>("/api/v1/products?status=active&limit=300"),
      ]);
      setAssignedProducts(assigned.data || []);
      setAllProducts(allRes.data || []);
    } catch {
      /* ignore */
    } finally {
      setProductPanelLoading(false);
    }
  };

  const refreshProductPanel = async () => {
    if (!productPanelFactory) return;
    const assigned = await api.get<{ data: Product[] }>(`/api/v1/factories/${productPanelFactory.id}/products`);
    setAssignedProducts(assigned.data || []);
  };

  const handleAssignProduct = async (productId: string) => {
    if (!productPanelFactory) return;
    setAssignLoading(true);
    try {
      await api.post(`/api/v1/factories/${productPanelFactory.id}/products`, { product_id: productId });
      await refreshProductPanel();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      alert(msg);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    if (!productPanelFactory) return;
    if (!confirm("ลบสินค้าออกจากโรงงานนี้?")) return;
    try {
      await api.delete(`/api/v1/factories/${productPanelFactory.id}/products/${productId}`);
      await refreshProductPanel();
    } catch {
      alert("Failed");
    }
  };

  const assignedIds = new Set(assignedProducts.map((p) => p.id));
  const filteredAll = allProducts.filter((p) => {
    const q = productSearch.toLowerCase();
    return (
      !assignedIds.has(p.id) &&
      (p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))
    );
  });

  const fieldClass =
    "w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Factories
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            {total} registered factories
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditId(null);
              setForm(emptyForm);
            } else {
              setShowForm(true);
              setProductPanelFactory(null);
            }
          }}
          className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all flex items-center gap-2"
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              New Factory
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-2 p-6 mb-6">
          <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">
            {editId ? "Edit Factory" : "New Factory"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">ชื่อโรงงาน *</label>
              <input
                type="text"
                placeholder="Factory Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">รหัสโรงงาน</label>
              <input
                type="text"
                placeholder="Factory Code (optional)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">ประเภทโรงงาน</label>
              <select
                value={form.factory_type}
                onChange={(e) => setForm({ ...form, factory_type: e.target.value })}
                className={fieldClass}
              >
                <option value="general">ทั่วไป (General)</option>
                <option value="sticker_printer">โรงพิมพ์สติ๊กเกอร์ (Sticker Printer)</option>
                <option value="applicator">โรงงานแปะสติ๊กเกอร์ (Applicator)</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">รูปแบบ Export</label>
              <select
                value={form.export_format}
                onChange={(e) => setForm({ ...form, export_format: Number(e.target.value) })}
                className={fieldClass}
              >
                <option value={1}>Format 1 — Flat CSV (แถวเดียว)</option>
                <option value={2}>Format 2 — Multi 4 Columns (fix 4 ม้วน)</option>
                <option value={3}>Format 3 — Multi N Columns (กำหนดม้วนเอง)</option>
                <option value={4}>Format 4 — Single Column (ไม่มี header)</option>
              </select>
              <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">
                {form.export_format === 1 && "แต่ละ roll เป็น 1 CSV แยกกัน มี header — URL, Serial, Ref1, Ref2, Lot, Roll"}
                {form.export_format === 2 && "จัด 4 ม้วนเรียงกันเป็น column ในไฟล์เดียว (fix 4 ม้วน/ไฟล์)"}
                {form.export_format === 3 && "จัด N ม้วนเรียงกันเป็น column — กำหนด 'จำนวนม้วนต่อไฟล์' ด้านล่าง"}
                {form.export_format === 4 && "แต่ละ roll เป็น 1 CSV แยกกัน ไม่มี header — URL, Serial, Ref1, Ref2, Roll"}
              </p>
            </div>
            {form.export_format === 3 && (
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">จำนวนม้วนต่อไฟล์</label>
                <input
                  type="number"
                  placeholder="4"
                  value={form.rolls_per_file}
                  onChange={(e) => setForm({ ...form, rolls_per_file: Number(e.target.value) || 4 })}
                  className={fieldClass}
                  min={1}
                />
                <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">
                  แต่ละไฟล์ CSV จะรวม {form.rolls_per_file} ม้วนเป็น column เรียงกัน
                </p>
              </div>
            )}
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">ชื่อผู้ติดต่อ</label>
              <input
                type="text"
                placeholder="Contact Name"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">เบอร์โทร</label>
              <input
                type="text"
                placeholder="Contact Phone"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">อีเมล</label>
              <input
                type="email"
                placeholder="Contact Email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 tracking-[0.3px]">ที่อยู่</label>
              <input
                type="text"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                className="h-[48px] px-8 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all"
              >
                {editId ? "Save Changes" : "Create Factory"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Assignment Panel */}
      {productPanelFactory && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-2 p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">
                สินค้าของโรงงาน: {productPanelFactory.name}
              </h2>
              <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-0.5">
                กำหนดว่าโรงงานนี้ผลิต/จัดการสินค้าอะไรได้บ้าง — factory user จะเห็นเฉพาะสินค้าที่ assign ให้
              </p>
            </div>
            <button
              onClick={() => setProductPanelFactory(null)}
              className="text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          {productPanelLoading ? (
            <div className="py-8 text-center text-[var(--md-on-surface-variant)]">
              <svg className="animate-spin w-5 h-5 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              กำลังโหลด...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Assigned products */}
              <div>
                <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-3">
                  สินค้าที่ assign แล้ว ({assignedProducts.length})
                </p>
                {assignedProducts.length === 0 ? (
                  <div className="border border-dashed border-[var(--md-outline-variant)] rounded-[var(--md-radius-md)] p-6 text-center text-[13px] text-[var(--md-on-surface-variant)]">
                    ยังไม่มีสินค้า — เลือกจากรายการขวา
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {assignedProducts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 bg-[var(--md-surface-container)] rounded-[var(--md-radius-md)] group"
                      >
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-10 h-10 rounded-[6px] object-cover flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[6px] bg-[var(--md-surface-dim)] flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-on-surface-variant)] opacity-40">
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[var(--md-on-surface)] leading-tight truncate">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                            {p.sku || "—"} · {p.points_per_scan} pts
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveProduct(p.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--md-error)] hover:bg-[var(--md-error-light)] rounded-[6px] p-1"
                          title="ลบออก"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: All products to add */}
              <div>
                <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-3">
                  เพิ่มสินค้า
                </p>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อสินค้า หรือ SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full h-[40px] px-3 mb-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] transition-all"
                />
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {filteredAll.length === 0 ? (
                    <p className="text-center text-[13px] text-[var(--md-on-surface-variant)] py-4">
                      {productSearch ? "ไม่พบสินค้าที่ค้นหา" : "สินค้าทุกรายการถูก assign แล้ว"}
                    </p>
                  ) : (
                    filteredAll.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-md)] hover:border-[var(--md-primary)] hover:bg-[var(--md-primary-light)] transition-all group cursor-pointer"
                        onClick={() => !assignLoading && handleAssignProduct(p.id)}
                      >
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-10 h-10 rounded-[6px] object-cover flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[6px] bg-[var(--md-surface-dim)] flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-on-surface-variant)] opacity-40">
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[var(--md-on-surface)] leading-tight truncate">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                            {p.sku || "—"} · {p.points_per_scan} pts
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-primary)]">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                          </svg>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Factory
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Code
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Type
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Export Format
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Contact
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Status
              </th>
              <th className="text-right px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]">
                  <svg className="animate-spin w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </td>
              </tr>
            ) : factories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]">
                  No factories yet
                </td>
              </tr>
            ) : (
              factories.map((f) => (
                <tr
                  key={f.id}
                  className={`border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors ${
                    productPanelFactory?.id === f.id ? "bg-[var(--md-primary-light)]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--md-on-surface)]">{f.name}</p>
                      {f.address && (
                        <p className="text-[11px] text-[var(--md-on-surface-variant)] truncate max-w-[200px]">
                          {f.address}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] font-medium text-[var(--md-on-surface)]">
                    {f.code || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${factoryTypeBadge[f.factory_type] || factoryTypeBadge.general}`}>
                      {factoryTypeLabels[f.factory_type] || f.factory_type}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-[12px] font-medium text-[var(--md-on-surface)]">
                        {exportFormatLabels[f.export_format] || `Format ${f.export_format}`}
                      </p>
                      <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                        {f.codes_per_roll?.toLocaleString()} codes/roll · {f.rolls_per_file} rolls/file
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-[12px] text-[var(--md-on-surface)]">{f.contact_name || "—"}</p>
                      {f.contact_phone && (
                        <p className="text-[11px] text-[var(--md-on-surface-variant)]">{f.contact_phone}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${
                        f.status === "active"
                          ? "bg-[var(--md-success-light)] text-[var(--md-success)]"
                          : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]"
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openProductPanel(f)}
                        className={`h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] transition-all ${
                          productPanelFactory?.id === f.id
                            ? "text-white bg-[var(--md-primary)]"
                            : "text-[var(--md-secondary)] bg-[var(--md-secondary-container,#e8def8)] hover:opacity-80"
                        }`}
                      >
                        สินค้า
                      </button>
                      <button
                        onClick={() => handleEdit(f)}
                        className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-primary)] bg-[var(--md-primary-light)] hover:opacity-80 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(f)}
                        disabled={actionId === f.id}
                        className={`h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] transition-all disabled:opacity-50 ${
                          f.status === "active"
                            ? "text-[var(--md-warning)] bg-[var(--md-warning-light)]"
                            : "text-[var(--md-success)] bg-[var(--md-success-light)]"
                        }`}
                      >
                        {f.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        disabled={actionId === f.id}
                        className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-error)] bg-[var(--md-error-light)] hover:opacity-80 transition-all disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
