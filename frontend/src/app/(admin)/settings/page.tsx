"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface CodeExportConfig {
  ref1_length?: number;
  ref1_format?: string;
  ref1_min_value?: number;
  scan_base_url?: string;
  lot_size?: number;
  url_format?: string;
  compact_code?: boolean;
  hmac_length?: number;
  max_url_length?: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  shortcode?: string;
  settings?: Record<string, unknown>;
  ref2_next?: number;
  status: string;
}

const defaultCodeExport: CodeExportConfig = {
  ref1_length: 10,
  ref1_format: "alphanumeric",
  ref1_min_value: 1000000000,
  scan_base_url: "https://qr.svsu.me",
  lot_size: 10000,
  url_format: "path",
  compact_code: true,
  hmac_length: 8,
  max_url_length: 0,
};

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<CodeExportConfig>(defaultCodeExport);

  const fetchTenant = async () => {
    try {
      const t = await api.get<Tenant>("/api/v1/settings/tenant");
      setTenant(t);
      const ce = (t.settings?.code_export as CodeExportConfig) || {};
      setForm({
        ref1_length: ce.ref1_length ?? defaultCodeExport.ref1_length,
        ref1_format: ce.ref1_format ?? defaultCodeExport.ref1_format,
        ref1_min_value: ce.ref1_min_value ?? defaultCodeExport.ref1_min_value,
        scan_base_url: ce.scan_base_url ?? defaultCodeExport.scan_base_url,
        lot_size: ce.lot_size ?? defaultCodeExport.lot_size,
        url_format: ce.url_format ?? defaultCodeExport.url_format,
        compact_code: ce.compact_code ?? defaultCodeExport.compact_code,
        hmac_length: ce.hmac_length ?? defaultCodeExport.hmac_length,
        max_url_length: ce.max_url_length ?? defaultCodeExport.max_url_length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to load tenant settings: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setSaved(false);
    try {
      const settings = {
        ...tenant.settings,
        code_export: form,
      };
      await api.patch("/api/v1/settings/tenant", { settings });
      setTenant((prev) => (prev ? { ...prev, settings } : null));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to save settings: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading settings...
        </div>
      </div>
    );
  }

  const fieldClass = `
    w-full h-[48px] px-4 border border-[var(--md-outline)]
    rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)]
    bg-transparent outline-none
    focus:border-[var(--md-primary)] focus:border-2
    transition-all duration-200
  `;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
          Settings
        </h1>
        <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
          Configure QR code export and tenant preferences
        </p>
      </div>

      {tenant && (
        <div className="max-w-[720px]">
          {/* Tenant info */}
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[var(--md-radius-md)] bg-[var(--md-primary-light)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[var(--md-primary)]">
                  <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[16px] font-medium text-[var(--md-on-surface)]">{tenant.name}</h2>
                <p className="text-[13px] text-[var(--md-on-surface-variant)]">
                  Slug: <span className="font-mono">{tenant.slug}</span>
                  {tenant.shortcode && <> &middot; Shortcode: <span className="font-mono font-bold text-[var(--md-primary)]">{tenant.shortcode}</span></>}
                  &middot; ID: <span className="font-mono">{tenant.id.slice(0, 8)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ref2 running number info */}
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[var(--md-radius-sm)] bg-[var(--md-success-light,#e8f5e9)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-success,#4caf50)]">
                  <path d="M3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.11 0-2 .9-2 2zm12 4c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm-9 8c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1H6v-1z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[16px] font-medium text-[var(--md-on-surface)]">ref2 Running Number</h3>
                <p className="text-[12px] text-[var(--md-on-surface-variant)]">
                  เลข QC 13 หลัก — running number ระดับ tenant ไม่ซ้ำกันข้ามทุก batch
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--md-surface-variant,#f5f5f5)] rounded-[var(--md-radius-sm)] p-4">
                <p className="text-[11px] text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1">ref2 ถัดไป</p>
                <p className="text-[20px] font-mono font-medium text-[var(--md-on-surface)]">
                  {tenant.ref2_next != null ? tenant.ref2_next.toLocaleString() : "200,000,000,000"}
                </p>
              </div>
              <div className="bg-[var(--md-surface-variant,#f5f5f5)] rounded-[var(--md-radius-sm)] p-4">
                <p className="text-[11px] text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1">ความจุคงเหลือ</p>
                <p className="text-[20px] font-mono font-medium text-[var(--md-on-surface)]">
                  {((999999999999 - (tenant.ref2_next ?? 200000000000))).toLocaleString()}
                </p>
                <p className="text-[10px] text-[var(--md-on-surface-variant)] mt-0.5">~800 พันล้าน codes สูงสุด</p>
              </div>
            </div>
          </div>

          {/* Code export settings */}
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[var(--md-radius-sm)] bg-[var(--md-info-light)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-info)]">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[16px] font-medium text-[var(--md-on-surface)]">QR Code Export</h3>
                <p className="text-[12px] text-[var(--md-on-surface-variant)]">
                  ref1 (ลูกค้าใส่มือ) &middot; scan URL &middot; lot size
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                    ref1_length
                  </label>
                  <input
                    type="number"
                    value={form.ref1_length ?? 10}
                    onChange={(e) => setForm({ ...form, ref1_length: parseInt(e.target.value) || 10 })}
                    min={8}
                    max={16}
                    className={fieldClass}
                  />
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">จำนวนหลัก ref1 (แนะนำ 10+)</p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                    ref1_min_value
                  </label>
                  <input
                    type="number"
                    value={form.ref1_min_value ?? 1000000000}
                    onChange={(e) => setForm({ ...form, ref1_min_value: parseInt(e.target.value) || 1000000000 })}
                    min={0}
                    className={fieldClass}
                  />
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">ค่าเริ่มต้น ref1</p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                    ref1_format
                  </label>
                  <select
                    value={form.ref1_format ?? "alphanumeric"}
                    onChange={(e) => setForm({ ...form, ref1_format: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="numeric">Numeric — เลขรันนิ่ง</option>
                    <option value="alphanumeric">Alphanumeric — เข้ารหัส (ป้องกันเดาสุ่ม)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                    lot_size
                  </label>
                  <input
                    type="number"
                    value={form.lot_size ?? 10000}
                    onChange={(e) => setForm({ ...form, lot_size: parseInt(e.target.value) || 10000 })}
                    min={1}
                    className={fieldClass}
                  />
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">จำนวนโค้ดต่อม้วน (เช่น 10,000)</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                    scan_base_url
                  </label>
                  <input
                    type="url"
                    value={form.scan_base_url ?? ""}
                    onChange={(e) => setForm({ ...form, scan_base_url: e.target.value })}
                    className={fieldClass}
                    placeholder="https://qr.svsu.me"
                  />
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">URL ฐานสำหรับ QR scan (ใช้ใน export)</p>
                </div>

                {/* QR URL Format Preview */}
                {tenant.shortcode && (
                  <div className="md:col-span-2 p-4 rounded-[var(--md-radius-md)] border border-[var(--md-primary)]/30 bg-[var(--md-primary-light,#e8f0fe)]">
                    <p className="text-[12px] font-medium text-[var(--md-on-surface)] mb-2">QR URL Format (Multi-Brand)</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-[14px] text-[var(--md-primary)] font-medium">
                        {(form.scan_base_url || "https://qr.svsu.me").replace(/\/s$/, "")}/{tenant.shortcode}/{"<ref1>"}
                      </span>
                    </div>
                    <p className="font-mono text-[13px] text-[var(--md-on-surface-variant)] mb-1">
                      ตัวอย่าง: {(form.scan_base_url || "https://qr.svsu.me").replace(/\/s$/, "")}/{tenant.shortcode}/A6FPZKTQL6
                    </p>
                    <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                      เมื่อลูกค้าสแกน QR → ระบบจะ redirect ไป {tenant.slug}.svsu.me/s/ref1 อัตโนมัติ
                    </p>
                  </div>
                )}

                {!tenant.shortcode && (
                  <div className="md:col-span-2 p-4 rounded-[var(--md-radius-md)] border border-[var(--md-error)]/30 bg-[var(--md-error-light,#fce8e6)]">
                    <p className="text-[13px] text-[var(--md-error)]">
                      ⚠ ยังไม่มี shortcode สำหรับ tenant นี้ — กรุณาติดต่อ super admin เพื่อตั้งค่า shortcode (เช่น &quot;jh&quot; สำหรับ Jula&apos;sHerb)
                    </p>
                  </div>
                )}
              </div>

              {/* Compact QR URL section */}
              <div className="border-t border-[var(--md-outline-variant)] pt-5 mt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-[var(--md-radius-sm)] bg-[var(--md-tertiary-light,#e8eaf6)] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--md-tertiary,#5c6bc0)]">
                      <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-[14px] font-medium text-[var(--md-on-surface)]">Compact QR URL</h4>
                    <p className="text-[11px] text-[var(--md-on-surface-variant)]">
                      สำหรับสติกเกอร์ขนาดเล็ก (1x1cm) — URL สั้นลง scan ง่ายขึ้น
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      URL Format
                    </label>
                    <select
                      value={form.url_format ?? "query"}
                      onChange={(e) => setForm({ ...form, url_format: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="query">Query — ?code=XXX (standard)</option>
                      <option value="path">Path — /XXX (สั้นกว่า 6 chars)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Compact Code
                    </label>
                    <select
                      value={form.compact_code ? "true" : "false"}
                      onChange={(e) => setForm({ ...form, compact_code: e.target.value === "true" })}
                      className={fieldClass}
                    >
                      <option value="false">Standard — SV2026-10001-1c8e92fb</option>
                      <option value="true">Compact — JH2Bj1c8e92 (base62, no hyphens)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      HMAC Length
                    </label>
                    <select
                      value={form.hmac_length ?? 8}
                      onChange={(e) => setForm({ ...form, hmac_length: parseInt(e.target.value) })}
                      className={fieldClass}
                    >
                      <option value={8}>8 chars (16M combos, standard)</option>
                      <option value={6}>6 chars (16M combos, compact)</option>
                      <option value={4}>4 chars (65K combos, ultra-compact)</option>
                    </select>
                    <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">ตัวอักษร HMAC ใน code (ยิ่งยาวยิ่งปลอดภัย)</p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Max URL Length
                    </label>
                    <input
                      type="number"
                      value={form.max_url_length ?? 0}
                      onChange={(e) => setForm({ ...form, max_url_length: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={100}
                      className={fieldClass}
                    />
                    <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">0 = ไม่จำกัด, 36 = สติกเกอร์ 1x1cm</p>
                  </div>
                </div>

                {/* URL Length Budget Preview */}
                {(() => {
                  const baseUrl = (form.scan_base_url || "https://qr.svsu.me").replace(/\/s$/, "");
                  const shortcode = tenant?.shortcode || "xx";
                  const hmacLen = form.hmac_length ?? 8;
                  const maxLen = form.max_url_length ?? 0;
                  const isCompact = form.compact_code;

                  const sampleRef1 = "A6FPZKTQL6";
                  const samplePrefix = shortcode.toUpperCase();
                  const sampleSerial = isCompact ? "FXsk" : "10000001";
                  const sampleHmac = "abcdef01".slice(0, hmacLen);

                  const newFormatUrl = `${baseUrl}/${shortcode}/${sampleRef1}`;

                  const sampleCode = isCompact
                    ? `${samplePrefix}${sampleSerial}${sampleHmac}`
                    : `SV2026-${sampleSerial}-${sampleHmac}`;

                  const urlLen = newFormatUrl.length;
                  const ok = maxLen === 0 || urlLen <= maxLen;

                  return (
                    <div className={`mt-4 p-4 rounded-[var(--md-radius-sm)] border ${ok ? "border-[var(--md-success,#4caf50)] bg-[var(--md-success-light,#e8f5e9)]" : "border-[var(--md-error)] bg-[var(--md-error-light)]"}`}>
                      <p className="text-[12px] font-medium text-[var(--md-on-surface)] mb-2">URL Preview</p>
                      <div className="space-y-2 mb-2">
                        <div>
                          <span className="text-[10px] text-[var(--md-on-surface-variant)] uppercase">QR Scan URL (ลิงค์ใน QR Code)</span>
                          <p className="font-mono text-[13px] text-[var(--md-primary)] font-medium break-all">{newFormatUrl}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--md-on-surface-variant)] uppercase">Internal HMAC Code (ใช้ verify ภายใน)</span>
                          <p className="font-mono text-[12px] text-[var(--md-on-surface-variant)] break-all">{sampleCode}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[var(--md-on-surface-variant)]">
                        <span>URL: {urlLen} chars</span>
                        <span>Ref1: {sampleRef1.length} chars</span>
                        <span className={`font-medium ${ok ? "text-[var(--md-success,#4caf50)]" : "text-[var(--md-error)]"}`}>
                          {maxLen > 0 ? `${urlLen} / ${maxLen} limit — ${ok ? "OK" : "OVER"}` : "No length limit"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="
                    h-[40px] px-6 bg-[var(--md-primary)] text-white
                    rounded-[var(--md-radius-xl)] text-[14px] font-medium
                    tracking-[0.1px]
                    hover:bg-[var(--md-primary-dark)]
                    disabled:opacity-60 disabled:cursor-not-allowed
                    active:scale-[0.98] transition-all duration-200
                  "
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--md-success)] font-medium animate-fade-in">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    Settings saved
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
