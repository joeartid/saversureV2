"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";
import { useTenant } from "@/components/TenantProvider";
import { Card, CardContent } from "@/components/ui/card";
import {
  clearPendingScan,
  getPendingScanTarget,
  resolvePendingCodeFromSearch,
  setPendingScan,
} from "@/lib/pendingScan";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface AuthResponse {
  access_token: string;
  profile_completed?: boolean;
}

function LoginPageInner() {
  const { tenantId, brandName, branding, ready } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");

  const pendingCode = useMemo(
    () => resolvePendingCodeFromSearch(searchParams),
    [searchParams]
  );

  useEffect(() => {
    if (pendingCode) setPendingScan(pendingCode, "qr");
  }, [pendingCode]);

  useEffect(() => {
    if (isLoggedIn()) router.replace(getPendingScanTarget("/scan"));
  }, [router]);

  useEffect(() => {
    if (!ready || !tenantId) return;
    api.get<{ client_id?: string; enabled?: boolean }>(`/api/v1/auth/google/config?tenant_id=${encodeURIComponent(tenantId)}`)
      .then((data) => setGoogleClientId(data.client_id || ""))
      .catch(() => {});
  }, [tenantId, ready]);

  const finishAuth = (tokens: AuthResponse) => {
    setToken(tokens.access_token);
    if (tokens.profile_completed === false) {
      sessionStorage.setItem("return_after_register", getPendingScanTarget("/scan"));
      router.replace("/register/complete");
      return;
    }
    if (!pendingCode) clearPendingScan();
    router.replace(pendingCode ? getPendingScanTarget("/scan") : "/scan");
  };

  const handleLineLogin = async () => {
    if (!ready || !tenantId) { setError("ยังไม่พบ tenant ของแบรนด์นี้"); return; }
    setLineLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ tenant_id: tenantId });
      if (pendingCode) { query.set("redirect_code", pendingCode); setPendingScan(pendingCode, "line"); }
      const data = await api.get<{ url: string }>(`/api/v1/auth/line?${query.toString()}`);
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "LINE Login ยังไม่พร้อมใช้งาน");
      setLineLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !tenantId) { setError("ยังไม่พบ tenant ของแบรนด์นี้"); return; }
    setLoading(true);
    setError("");
    try {
      const data = await api.post<AuthResponse>("/api/v1/auth/login-phone", { tenant_id: tenantId, phone: phone.trim(), password });
      if (pendingCode) setPendingScan(pendingCode, "phone");
      finishAuth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!ready || !tenantId) { setError("ยังไม่พบ tenant ของแบรนด์นี้"); return; }
    if (!googleClientId) { setError("Google Login ยังไม่ถูกตั้งค่าสำหรับแบรนด์นี้"); return; }
    setGoogleLoading(true);
    setError("");
    try {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')) { resolve(); return; }
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("โหลด Google script ไม่สำเร็จ"));
        document.head.appendChild(script);
      });
      await new Promise<void>((resolve, reject) => {
        window.google?.accounts?.id?.initialize({
          client_id: googleClientId,
          callback: async (response: { credential?: string }) => {
            try {
              if (!response.credential) throw new Error("ไม่ได้รับ Google credential");
              if (pendingCode) setPendingScan(pendingCode, "google");
              const data = await api.post<AuthResponse>("/api/v1/auth/google/login", { tenant_id: tenantId, id_token: response.credential });
              finishAuth(data);
              resolve();
            } catch (err) { reject(err); }
          },
          ux_mode: "popup",
          context: "signin",
        });
        window.google?.accounts?.id?.prompt();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google Login ไม่สำเร็จ");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full flex-col">
        {/* Header */}
        <div className="relative overflow-hidden bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pb-10 pt-10 text-white">
          <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 animate-float" />
          <div className="absolute -bottom-6 -left-4 h-20 w-20 rounded-full bg-white/5 animate-float-delay-1" />
          <div className="absolute right-12 bottom-4 h-10 w-10 rounded-full animate-float-delay-2" style={{ background: 'rgba(255,193,7,0.15)' }} />
          <div className="absolute left-1/3 -top-3 h-14 w-14 rounded-full animate-float-delay-1" style={{ background: 'rgba(124,92,191,0.1)' }} />
          <div className="absolute right-1/4 top-8 h-8 w-8 rounded-full animate-float" style={{ background: 'rgba(232,67,147,0.1)' }} />

          <div className="relative flex items-center gap-3.5 animate-bounce-in">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 shadow-lg">
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt={brandName} className="h-9 w-9 object-contain" />
              ) : (
                <span className="text-xl font-bold">{brandName.slice(0, 1)}</span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/60">เข้าสู่ระบบ</p>
              <h1 className="text-xl font-bold leading-tight">{brandName}</h1>
            </div>
          </div>

          {pendingCode ? (
            <div className="relative mt-5 rounded-xl bg-white/15 px-4 py-3 ring-2 ring-white/30 animate-pulse-glow">
              <p className="text-[11px] text-white/60">รหัสสินค้าที่รอสแกน</p>
              <p className="text-base font-bold tracking-widest mt-0.5">{pendingCode}</p>
              <p className="text-[12px] text-white/70 mt-1">เข้าสู่ระบบแล้วระบบจะสะสมแต้มให้อัตโนมัติ</p>
            </div>
          ) : (
            <p className="relative mt-3 text-[13px] text-white/70 leading-relaxed">
              สะสมแต้ม แลกของรางวัล และรับสิทธิพิเศษมากมาย
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 px-4 py-5">
          {!ready && (
            <p className="text-center text-sm text-muted-foreground">กำลังโหลดข้อมูลแบรนด์...</p>
          )}
          {ready && !tenantId && (
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="p-3 text-sm text-amber-900">
                ยังไม่พบ tenant — เปิดผ่านโดเมนแบรนด์ หรือตั้งค่า NEXT_PUBLIC_TENANT_ID สำหรับ dev
              </CardContent>
            </Card>
          )}
          {error && (
            <Card className="border-red-200 bg-red-50 shadow-sm">
              <CardContent className="p-3 flex items-start gap-2.5">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0 text-destructive mt-0.5"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Login methods */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">เลือกวิธีเข้าสู่ระบบ</p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleLineLogin}
                  disabled={lineLoading || !ready || !tenantId}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#06C755] text-sm font-semibold text-white transition-all duration-200 hover:shadow-md active:scale-[0.96] disabled:opacity-60"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  <span>{lineLoading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย LINE"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading || !ready || !tenantId}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-white text-sm font-semibold text-foreground transition-all duration-200 hover:shadow-md active:scale-[0.96] disabled:opacity-60"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>{googleLoading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPhoneForm((p) => !p)}
                  disabled={!ready || !tenantId}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-muted text-sm font-semibold text-foreground transition-all duration-200 hover:shadow-md active:scale-[0.96] disabled:opacity-60"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>เข้าสู่ระบบด้วยเบอร์โทร</span>
                </button>
              </div>

              {showPhoneForm && (
                <form onSubmit={handlePhoneLogin} className="mt-4 space-y-3 border-t border-border pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">เบอร์โทร</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0XX-XXX-XXXX" required
                      className="h-11 w-full rounded-lg border border-input bg-muted px-3.5 text-sm outline-none transition focus:border-[var(--jh-green)] focus:bg-white focus:ring-2 focus:ring-[var(--jh-green)]/20" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">รหัสผ่าน</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่านของคุณ" required
                      className="h-11 w-full rounded-lg border border-input bg-muted px-3.5 text-sm outline-none transition focus:border-[var(--jh-green)] focus:bg-white focus:ring-2 focus:ring-[var(--jh-green)]/20" />
                  </div>
                  <button type="submit" disabled={loading || !ready || !tenantId}
                    className="h-11 w-full rounded-xl bg-[var(--jh-green)] text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50">
                    {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Register + Forgot */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">ยังไม่มีบัญชี?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">สมัครสมาชิกฟรี</p>
                </div>
                <Link href={pendingCode ? `/register?code=${encodeURIComponent(pendingCode)}` : "/register"} className="shrink-0 rounded-full bg-[var(--jh-orange)] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.96]">
                  สมัครสมาชิก
                </Link>
              </div>

              <div className="my-3 h-px bg-border" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">ลืมรหัสผ่าน?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">รีเซ็ตผ่าน OTP</p>
                </div>
                <Link href="/forgot-password" className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs font-bold text-foreground">
                  รีเซ็ต
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="px-2 text-center text-[11px] text-muted-foreground">
            เข้าสู่ระบบสำเร็จ ระบบจะพาไปหน้าสะสมแต้มอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginPageInner />
    </Suspense>
  );
}
