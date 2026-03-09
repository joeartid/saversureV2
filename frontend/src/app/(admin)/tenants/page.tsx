"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTenantContext } from "@/lib/tenant-context";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  shortcode?: string;
  settings?: Record<string, unknown>;
  ref2_next?: number;
  status: string;
  created_at: string;
}

interface CreateForm {
  name: string;
  slug: string;
  shortcode: string;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<Tenant | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", slug: "", shortcode: "" });
  const [editForm, setEditForm] = useState<{ name: string; shortcode: string; status: string }>({ name: "", shortcode: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const { switchTenant, activeTenantId } = useTenantContext();

  const fetchTenants = async () => {
    try {
      const res = await api.get<{ data: Tenant[] }>("/api/v1/tenants");
      setTenants(res?.data || []);
    } catch {
      alert("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.slug) return;
    setSaving(true);
    try {
      await api.post("/api/v1/tenants", {
        name: createForm.name,
        slug: createForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
        shortcode: createForm.shortcode.toLowerCase().replace(/[^a-z0-9]/g, ""),
        settings: {},
      });
      setCreateDialog(false);
      setCreateForm({ name: "", slug: "", shortcode: "" });
      fetchTenants();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create tenant");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDialog) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/tenants/${editDialog.id}`, {
        name: editForm.name || undefined,
        shortcode: editForm.shortcode || undefined,
        status: editForm.status || undefined,
      });
      setEditDialog(null);
      fetchTenants();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update tenant");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (t: Tenant) => {
    setEditForm({ name: t.name, shortcode: t.shortcode || "", status: t.status });
    setEditDialog(t);
  };

  const fieldClass =
    "w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading tenants...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Tenant Management
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            จัดการแบรนด์ทั้งหมดในระบบ — สร้าง แก้ไข สลับดู
          </p>
        </div>
        <button
          onClick={() => setCreateDialog(true)}
          className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
          สร้างแบรนด์ใหม่
        </button>
      </div>

      {/* Tenant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {tenants.map((t) => (
          <div
            key={t.id}
            className={`bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-5 border-2 transition-all duration-200 ${
              t.id === activeTenantId
                ? "border-[var(--md-primary)]"
                : "border-transparent hover:border-[var(--md-outline-variant)]"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-[var(--md-radius-md)] flex items-center justify-center text-[14px] font-bold text-white"
                  style={{ backgroundColor: t.id === activeTenantId ? "var(--md-primary)" : "#78909c" }}
                >
                  {t.shortcode?.toUpperCase() || t.name[0]}
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-[var(--md-on-surface)]">{t.name}</h3>
                  <p className="text-[12px] text-[var(--md-on-surface-variant)] font-mono">
                    {t.slug}{t.shortcode ? ` · ${t.shortcode}` : ""}
                  </p>
                </div>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[t.status] || statusColors.inactive}`}>
                {t.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[var(--md-surface-variant,#f5f5f5)] rounded-[var(--md-radius-sm)] p-3">
                <p className="text-[10px] text-[var(--md-on-surface-variant)] uppercase tracking-wider mb-0.5">Shortcode</p>
                <p className="text-[15px] font-mono font-medium text-[var(--md-on-surface)]">
                  {t.shortcode || "—"}
                </p>
              </div>
              <div className="bg-[var(--md-surface-variant,#f5f5f5)] rounded-[var(--md-radius-sm)] p-3">
                <p className="text-[10px] text-[var(--md-on-surface-variant)] uppercase tracking-wider mb-0.5">QR URL</p>
                <p className="text-[11px] font-mono text-[var(--md-on-surface)] truncate">
                  {t.shortcode ? `qr.svsu.me/${t.shortcode}/` : "—"}
                </p>
              </div>
              <div className="bg-[var(--md-surface-variant,#f5f5f5)] rounded-[var(--md-radius-sm)] p-3">
                <p className="text-[10px] text-[var(--md-on-surface-variant)] uppercase tracking-wider mb-0.5">Consumer</p>
                <p className="text-[11px] font-mono text-[var(--md-on-surface)] truncate">
                  {t.slug}.svsu.me
                </p>
              </div>
              <div className="bg-[var(--md-surface-variant,#f5f5f5)] rounded-[var(--md-radius-sm)] p-3">
                <p className="text-[10px] text-[var(--md-on-surface-variant)] uppercase tracking-wider mb-0.5">Ref2 Next</p>
                <p className="text-[13px] font-mono text-[var(--md-on-surface)]">
                  {t.ref2_next?.toLocaleString() || "—"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => switchTenant(t.id)}
                disabled={t.id === activeTenantId}
                className={`flex-1 h-[36px] rounded-[var(--md-radius-xl)] text-[13px] font-medium transition-all duration-200 ${
                  t.id === activeTenantId
                    ? "bg-[var(--md-primary-light)] text-[var(--md-primary)] cursor-default"
                    : "border border-[var(--md-outline-variant)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)]"
                }`}
              >
                {t.id === activeTenantId ? "Active" : "Switch"}
              </button>
              <button
                onClick={() => openEdit(t)}
                className="h-[36px] px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] text-[13px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] transition-all duration-200"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      {createDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setCreateDialog(false)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[480px] max-w-[95vw] md-elevation-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[20px] font-medium text-[var(--md-on-surface)] mb-1">สร้างแบรนด์ใหม่</h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-6">กรอกข้อมูลพื้นฐานของแบรนด์ สามารถตั้งค่าเพิ่มเติมได้ภายหลัง</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-wider">ชื่อแบรนด์</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCreateForm({
                      ...createForm,
                      name,
                      slug: createForm.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20),
                    });
                  }}
                  className={fieldClass}
                  placeholder="เช่น Beauterry"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-wider">Slug</label>
                  <input
                    type="text"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    className={fieldClass}
                    placeholder="beauterry"
                    required
                  />
                  <p className="text-[10px] text-[var(--md-on-surface-variant)] mt-1">ใช้ใน URL: {createForm.slug || "xxx"}.svsu.me</p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-wider">Shortcode</label>
                  <input
                    type="text"
                    value={createForm.shortcode}
                    onChange={(e) => setCreateForm({ ...createForm, shortcode: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) })}
                    className={fieldClass}
                    placeholder="bt"
                    maxLength={4}
                  />
                  <p className="text-[10px] text-[var(--md-on-surface-variant)] mt-1">ใช้ใน QR: qr.svsu.me/{createForm.shortcode || "xx"}/ref1</p>
                </div>
              </div>

              {createForm.name && createForm.slug && (
                <div className="p-3 rounded-[var(--md-radius-sm)] bg-[var(--md-primary-light,#e8f0fe)] border border-[var(--md-primary)]/20">
                  <p className="text-[12px] font-medium text-[var(--md-on-surface)] mb-1">Preview URLs</p>
                  <p className="text-[11px] font-mono text-[var(--md-on-surface-variant)]">Consumer: {createForm.slug}.svsu.me</p>
                  {createForm.shortcode && <p className="text-[11px] font-mono text-[var(--md-on-surface-variant)]">QR Scan: qr.svsu.me/{createForm.shortcode}/{"<ref1>"}</p>}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateDialog(false)} className="h-[40px] px-5 text-[14px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] transition-all">
                  ยกเลิก
                </button>
                <button type="submit" disabled={saving} className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-60 transition-all">
                  {saving ? "Creating..." : "สร้างแบรนด์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditDialog(null)}>
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-[480px] max-w-[95vw] md-elevation-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[20px] font-medium text-[var(--md-on-surface)] mb-1">แก้ไข {editDialog.name}</h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-6">Slug: <span className="font-mono">{editDialog.slug}</span> &middot; ID: <span className="font-mono">{editDialog.id.slice(0, 8)}</span></p>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-wider">ชื่อแบรนด์</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-wider">Shortcode</label>
                  <input
                    type="text"
                    value={editForm.shortcode}
                    onChange={(e) => setEditForm({ ...editForm, shortcode: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) })}
                    className={fieldClass}
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 uppercase tracking-wider">Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={fieldClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditDialog(null)} className="h-[40px] px-5 text-[14px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] transition-all">
                  ยกเลิก
                </button>
                <button type="submit" disabled={saving} className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-60 transition-all">
                  {saving ? "Saving..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
