"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";
import { useTenant } from "@/components/TenantProvider";
import {
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
  const { tenantId, brandName, branding } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
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
    if (pendingCode) {
      setPendingScan(pendingCode, "qr");
    }
  }, [pendingCode]);

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace(getPendingScanTarget("/scan"));
    }
  }, [router]);

  useEffect(() => {
    if (!tenantId) return;
    api
      .get<{ client_id?: string; enabled?: boolean }>(
        `/api/v1/auth/google/config?tenant_id=${encodeURIComponent(tenantId)}`
      )
      .then((data) => setGoogleClientId(data.client_id || ""))
      .catch(() => {});
  }, [tenantId]);

  const finishAuth = (tokens: AuthResponse) => {
    setToken(tokens.access_token);
    if (tokens.profile_completed === false) {
      sessionStorage.setItem("return_after_register", getPendingScanTarget("/scan"));
      router.replace("/register/complete");
      return;
    }
    router.replace(getPendingScanTarget("/scan"));
  };

  const handleLineLogin = async () => {
    if (!tenantId) {
      setError("ยังไม่พบ tenant ของแบรนด์นี้");
      return;
    }

    setLineLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ tenant_id: tenantId });
      if (pendingCode) {
        query.set("redirect_code", pendingCode);
        setPendingScan(pendingCode, "line");
      }
      const data = await api.get<{ url: string }>(`/api/v1/auth/line?${query.toString()}`);
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "LINE Login ยังไม่พร้อมใช้งาน");
      setLineLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setError("ยังไม่พบ tenant ของแบรนด์นี้");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await api.post<AuthResponse>("/api/v1/auth/login", {
        tenant_id: tenantId,
        email: email.trim(),
        password,
      });
      if (pendingCode) {
        setPendingScan(pendingCode, "email");
      }
      finishAuth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!tenantId) {
      setError("ยังไม่พบ tenant ของแบรนด์นี้");
      return;
    }
    if (!googleClientId) {
      setError("Google Login ยังไม่ถูกตั้งค่าสำหรับแบรนด์นี้");
      return;
    }

    setGoogleLoading(true);
    setError("");

    try {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          'script[src="https://accounts.google.com/gsi/client"]'
        );
        if (existing) {
          resolve();
          return;
        }
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
              if (!response.credential) {
                throw new Error("ไม่ได้รับ Google credential");
              }
              if (pendingCode) {
                setPendingScan(pendingCode, "google");
              }
              const data = await api.post<AuthResponse>("/api/v1/auth/google/login", {
                tenant_id: tenantId,
                id_token: response.credential,
              });
              finishAuth(data);
              resolve();
            } catch (err) {
              reject(err);
            }
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

  const cardClass =
    "w-full rounded-[24px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_50px_rgba(18,52,29,0.12)] backdrop-blur";
  const inputClass =
    "h-12 w-full rounded-2xl border border-[var(--outline)] bg-white px-4 text-[14px] outline-none transition focus:border-[var(--primary)]";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--surface-dim)_0%,#ffffff_46%,#f7faf7_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-5 pb-8 pt-6">
        <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-dark,#245c31)_100%)] px-5 pb-6 pt-7 text-white shadow-[0_24px_60px_rgba(31,85,45,0.28)]">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
            <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/15 ring-1 ring-white/25">
                  {branding?.logo_url ? (
                    <img
                      src={branding.logo_url}
                      alt={brandName}
                      className="h-9 w-9 object-contain"
                    />
                  ) : (
                    <span className="text-xl font-bold">{brandName.slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/75">
                    Brand Login
                  </p>
                  <h1 className="text-2xl font-bold leading-tight">{brandName}</h1>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[24px] bg-white/12 p-4 ring-1 ring-white/15">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                พร้อมสแกนต่อ
              </p>
              <p className="mt-2 text-lg font-semibold leading-snug">
                เข้าสู่ระบบหรือสมัครสมาชิก แล้วระบบจะพาคุณกลับไปที่หน้าสแกนทันที
              </p>
              {pendingCode && (
                <div className="mt-4 inline-flex rounded-full bg-black/20 px-4 py-2 text-sm font-medium tracking-[0.16em]">
                  CODE {pendingCode}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {error && (
            <div className="rounded-2xl border border-[var(--error)]/20 bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
              {error}
            </div>
          )}

          <div className={cardClass}>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLineLogin}
                disabled={lineLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#06C755] px-4 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
              >
                <span className="text-base">LINE</span>
                <span>{lineLoading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย LINE"}</span>
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--outline)] bg-white px-4 text-sm font-semibold text-[var(--on-surface)] transition active:scale-[0.99] disabled:opacity-60"
              >
                <span className="text-base">G</span>
                <span>{googleLoading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm((prev) => !prev)}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--primary)]/8 px-4 text-sm font-semibold text-[var(--primary)] transition active:scale-[0.99]"
              >
                เข้าสู่ระบบด้วย Email
              </button>
            </div>

            {showEmailForm && (
              <form onSubmit={handleEmailLogin} className="mt-4 space-y-3 border-t border-[var(--outline-variant)] pt-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={inputClass}
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  className={inputClass}
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                </button>
              </form>
            )}
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-[var(--on-surface)]">
                  ยังไม่มีบัญชี?
                </p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  สมัครสมาชิกใหม่ แล้วกลับไปสแกนสะสมแต้มต่อได้ทันที
                </p>
              </div>
              <Link
                href={pendingCode ? `/register?code=${encodeURIComponent(pendingCode)}` : "/register"}
                className="shrink-0 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                สมัครสมาชิก
              </Link>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-container,#f5f7f4)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--on-surface)]">
                  ลืมรหัสผ่าน?
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  รีเซ็ตรหัสผ่านด้วย OTP ผ่านเบอร์โทรศัพท์
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="rounded-full border border-[var(--outline)] px-4 py-2 text-sm font-semibold text-[var(--on-surface)]"
              >
                รีเซ็ต
              </Link>
            </div>
          </div>

          <p className="px-1 text-center text-xs leading-6 text-[var(--on-surface-variant)]">
            เมื่อเข้าสู่ระบบสำเร็จ ระบบจะกลับไปยังหน้าสแกนหลัก และถ้ามีรหัสที่สแกนค้างไว้จะทำรายการต่อให้อัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--surface-dim)]" />}>
      <LoginPageInner />
    </Suspense>
  );
}
