"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTenantContext } from "@/lib/tenant-context";

interface BrandingSettings {
  logo_url: string;
  favicon_url: string;
  brand_name: string;
  primary_color: string;
  accent_color: string;
  bg_color: string;
  header_bg: string;
  custom_css: string;
  welcome_text: string;
  footer_text: string;
}

const defaultBranding: BrandingSettings = {
  logo_url: "",
  favicon_url: "",
  brand_name: "",
  primary_color: "#1976d2",
  accent_color: "#ff9800",
  bg_color: "#ffffff",
  header_bg: "#1976d2",
  custom_css: "",
  welcome_text: "",
  footer_text: "",
};

export default function BrandingPage() {
  const [form, setForm] = useState<BrandingSettings>(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewScreen, setPreviewScreen] = useState<"home" | "scan" | "rewards">("home");
  const { activeTenant } = useTenantContext();

  const fetchBranding = async () => {
    try {
      const data = await api.get<BrandingSettings>("/api/v1/branding");
      setForm({ ...defaultBranding, ...data });
    } catch {
      setForm(defaultBranding);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const data = await api.put<BrandingSettings>("/api/v1/branding", form);
      setForm({ ...defaultBranding, ...data });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200";

  const textareaClass =
    "w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none resize-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200";

  const cssTextareaClass =
    "w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] font-mono text-[var(--md-on-surface)] bg-transparent outline-none resize-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200 min-h-[180px]";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
          Branding
        </h1>
        <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
          ตั้งค่าแบรนด์ของ tenant — โลโก้ สี ข้อความ
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        <form onSubmit={handleSave} className="flex-1 max-w-[640px] space-y-6">
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
              Identity
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  brand_name
                </label>
                <input
                  type="text"
                  value={form.brand_name}
                  onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                  className={fieldClass}
                  placeholder="Brand Name"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  logo_url
                </label>
                <input
                  type="url"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className={fieldClass}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  favicon_url
                </label>
                <input
                  type="url"
                  value={form.favicon_url}
                  onChange={(e) => setForm({ ...form, favicon_url: e.target.value })}
                  className={fieldClass}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
              Colors
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  primary_color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-12 h-[48px] p-1 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  accent_color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="w-12 h-[48px] p-1 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.accent_color}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  bg_color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.bg_color}
                    onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                    className="w-12 h-[48px] p-1 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.bg_color}
                    onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  header_bg
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.header_bg}
                    onChange={(e) => setForm({ ...form, header_bg: e.target.value })}
                    className="w-12 h-[48px] p-1 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.header_bg}
                    onChange={(e) => setForm({ ...form, header_bg: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
              Content
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  welcome_text
                </label>
                <textarea
                  value={form.welcome_text}
                  onChange={(e) => setForm({ ...form, welcome_text: e.target.value })}
                  className={textareaClass}
                  rows={4}
                  placeholder="Welcome message..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                  footer_text
                </label>
                <textarea
                  value={form.footer_text}
                  onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
                  className={textareaClass}
                  rows={3}
                  placeholder="Footer text..."
                />
              </div>
            </div>
          </div>

          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6">
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
              Advanced
            </h2>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                custom_css
              </label>
              <textarea
                value={form.custom_css}
                onChange={(e) => setForm({ ...form, custom_css: e.target.value })}
                className={cssTextareaClass}
                placeholder=".my-class { color: red; }"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
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
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--md-success)] font-medium">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Saved
              </span>
            )}
          </div>
        </form>

        <div className="xl:w-[380px] flex-shrink-0">
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-5 sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Consumer Preview
              </h3>
              {activeTenant?.slug && (
                <a
                  href={`https://${activeTenant.slug}.svsu.me`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--md-primary)] hover:underline"
                >
                  เปิดจริง &rarr;
                </a>
              )}
            </div>

            {/* Screen Tabs */}
            <div className="flex gap-1 mb-3 p-1 bg-[var(--md-surface-variant,#f0f0f0)] rounded-[var(--md-radius-md)]">
              {(["home", "scan", "rewards"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPreviewScreen(s)}
                  className={`flex-1 h-[30px] rounded-[var(--md-radius-sm)] text-[11px] font-medium transition-all ${
                    previewScreen === s
                      ? "bg-white text-[var(--md-on-surface)] shadow-sm"
                      : "text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
                  }`}
                >
                  {s === "home" ? "หน้าหลัก" : s === "scan" ? "สแกน QR" : "รางวัล"}
                </button>
              ))}
            </div>

            {/* Phone Frame */}
            <div className="mx-auto w-[300px] rounded-[28px] border-[3px] border-gray-800 bg-gray-800 p-[2px] shadow-xl">
              <div className="rounded-[24px] overflow-hidden" style={{ backgroundColor: form.bg_color || "#ffffff" }}>
                {/* Status bar */}
                <div className="h-[28px] bg-gray-800 flex items-center justify-between px-5">
                  <span className="text-[10px] text-gray-400">9:41</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-2 rounded-sm border border-gray-400" />
                    <svg viewBox="0 0 16 12" className="w-3 h-3 text-gray-400"><path fill="currentColor" d="M1 8h2v4H1zm4-3h2v7H5zm4-3h2v10H9zm4-2h2v12h-2z"/></svg>
                  </div>
                </div>

                {/* Header */}
                <div
                  className="px-4 py-3 flex items-center gap-3"
                  style={{ backgroundColor: form.header_bg || form.primary_color || "#1976d2" }}
                >
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="h-7 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                      {form.brand_name?.[0] || "?"}
                    </div>
                  )}
                  <span className="text-white font-semibold text-[14px] truncate">
                    {form.brand_name || "Brand Name"}
                  </span>
                </div>

                {/* Content */}
                <div className="min-h-[420px]">
                  {previewScreen === "home" && (
                    <div className="p-4 space-y-3">
                      <div className="rounded-xl p-4" style={{ backgroundColor: form.primary_color || "#1976d2", color: "#fff" }}>
                        <p className="text-[11px] font-medium opacity-80 mb-1">ยินดีต้อนรับ</p>
                        <p className="text-[13px] leading-relaxed">{form.welcome_text || "สะสมแต้มจากการสแกน QR Code บนสินค้า"}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-[11px] text-gray-500 mb-1">แต้มสะสม</p>
                        <p className="text-[28px] font-bold" style={{ color: form.primary_color || "#1976d2" }}>1,250</p>
                        <p className="text-[10px] text-gray-400">คะแนน</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-3 text-center border border-gray-200">
                          <p className="text-[18px] mb-0.5">📷</p>
                          <p className="text-[11px] font-medium text-gray-700">สแกน QR</p>
                        </div>
                        <div className="rounded-lg p-3 text-center border border-gray-200">
                          <p className="text-[18px] mb-0.5">🎁</p>
                          <p className="text-[11px] font-medium text-gray-700">แลกรางวัล</p>
                        </div>
                      </div>
                      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: form.accent_color || "#ff9800" }}>
                        <div className="p-3 text-white">
                          <p className="text-[10px] font-medium opacity-80">โปรโมชั่นพิเศษ</p>
                          <p className="text-[13px] font-medium mt-0.5">สแกนครบ 10 ชิ้น รับฟรี!</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewScreen === "scan" && (
                    <div className="p-4 space-y-3">
                      <div className="text-center py-2">
                        <p className="text-[14px] font-medium text-gray-800 mb-1">สแกน QR Code</p>
                        <p className="text-[11px] text-gray-500">เพื่อสะสมแต้ม</p>
                      </div>
                      <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                        <div className="text-center">
                          <p className="text-[40px] mb-2">📸</p>
                          <p className="text-[12px] text-gray-500">กล้องจะเปิดที่นี่</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-gray-400 mb-2">หรือกรอกรหัสด้วยตนเอง</p>
                        <div className="flex gap-2">
                          <div className="flex-1 h-[40px] rounded-lg border border-gray-300 flex items-center px-3">
                            <span className="text-[12px] text-gray-400">A6FPZKTQL6</span>
                          </div>
                          <div className="h-[40px] px-4 rounded-lg flex items-center justify-center text-white text-[12px] font-medium" style={{ backgroundColor: form.primary_color || "#1976d2" }}>
                            ส่ง
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewScreen === "rewards" && (
                    <div className="p-4 space-y-3">
                      <p className="text-[14px] font-medium text-gray-800">รางวัลที่แลกได้</p>
                      {[
                        { name: "ส่วนลด 50 บาท", pts: 200, img: "🏷️" },
                        { name: "กระเป๋าผ้า Limited", pts: 500, img: "👜" },
                        { name: "Gift Set พิเศษ", pts: 1000, img: "🎁" },
                      ].map((r, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-[20px]">{r.img}</div>
                          <div className="flex-1">
                            <p className="text-[13px] font-medium text-gray-800">{r.name}</p>
                            <p className="text-[11px]" style={{ color: form.primary_color || "#1976d2" }}>{r.pts} แต้ม</p>
                          </div>
                          <div className="h-[28px] px-3 rounded-full text-[11px] font-medium text-white flex items-center" style={{ backgroundColor: form.accent_color || "#ff9800" }}>
                            แลก
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {form.footer_text && (
                  <div className="px-4 py-2 border-t border-gray-200">
                    <p className="text-[10px] text-gray-400 text-center">{form.footer_text}</p>
                  </div>
                )}

                {/* Home indicator */}
                <div className="flex justify-center pb-2 pt-1">
                  <div className="w-[100px] h-[4px] rounded-full bg-gray-300" />
                </div>
              </div>
            </div>

            {activeTenant && (
              <p className="text-[11px] text-[var(--md-on-surface-variant)] text-center mt-3">
                Preview: <span className="font-mono font-medium">{activeTenant.slug}.svsu.me</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
