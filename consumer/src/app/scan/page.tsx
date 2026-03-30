"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api, ApiError } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";
import {
  type MultiBalance,
  getCurrencyIcon,
  getPrimaryBalance,
  getSecondaryBalances,
} from "@/lib/currency";
import { getTenantId } from "@/lib/tenant";
import { initLiff, getLiff } from "@/lib/liff";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  clearPendingScan,
  getPendingScanTarget,
  resolvePendingCodeFromSearch,
  setPendingScan,
} from "@/lib/pendingScan";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

interface ScanResult {
  status: string;
  points_earned?: number;
  bonus_points?: number;
  total_points?: number;
  bonus_currency?: string;
  bonus_currency_amount?: number;
  bonus_currency_name?: string;
  bonus_currency_icon?: string;
  campaign_id?: string;
  message: string;
  message_th?: string;
  message_en?: string;
  ref1?: string;
  product_name?: string | null;
  product_sku?: string | null;
  product_image_url?: string | null;
}

interface ScanErrorDetail {
  message: string;
  message_th?: string;
  message_en?: string;
  ref1?: string;
  product_name?: string | null;
  product_sku?: string | null;
  product_image_url?: string | null;
}

function ScanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState<ScanErrorDetail | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [inLineApp, setInLineApp] = useState(false);
  const autoScanStartedRef = useRef(false);
  const autoScan = searchParams.get("auto") === "1";
  const urlCode = (searchParams.get("code") || searchParams.get("pending_code") || searchParams.get("redirect_code") || "").trim().toUpperCase();
  const queryCode = urlCode || (autoScan ? resolvePendingCodeFromSearch(searchParams) : "");

  const primaryBalance = getPrimaryBalance(balances);
  const secondaryBalances = getSecondaryBalances(balances);

  const fetchBalances = useCallback(() => {
    if (isLoggedIn()) {
      api.get<{ data: MultiBalance[] }>("/api/v1/my/balances")
        .then((d) => setBalances(d.data ?? []))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    void initLiffAndLogin();
  }, []);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason?.message || "";

      if (
        reason?.name === "AbortError" ||
        message.includes("play() request was interrupted") ||
        message.includes("media was removed from the document") ||
        message.includes("The play() request was interrupted")
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  useEffect(() => {
    if (queryCode) {
      setCode(queryCode.toUpperCase());
      setPendingScan(queryCode, "qr");
    } else if (!autoScan) {
      clearPendingScan();
    }
  }, [queryCode, autoScan]);

  const initLiffAndLogin = async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) { fetchBalances(); return; }
      const liffData = await api.get<{ liff_id: string }>("/api/v1/auth/line/liff-id").catch(() => ({ liff_id: "" }));
      const liffId = liffData.liff_id;
      if (!liffId) { fetchBalances(); return; }
      const liff = await initLiff(liffId);
      if (liff.isInClient()) setInLineApp(true);
      if (liff.isInClient() || (liff.isLoggedIn() && !isLoggedIn())) {
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return; }
        const accessToken = liff.getAccessToken();
        if (accessToken && !isLoggedIn()) {
          const tokens = await api.post<{ access_token: string; profile_completed?: boolean }>("/api/v1/auth/line/liff-token", { access_token: accessToken, tenant_id: tenantId });
          setToken(tokens.access_token);
          if (tokens.profile_completed === false) {
            sessionStorage.setItem("return_after_register", getPendingScanTarget("/scan"));
            router.replace("/register/complete");
            return;
          }
        }
      }
    } catch { /* LIFF init failed */ }
    fetchBalances();
  };

  useEffect(() => {
    if (!autoScan || !queryCode || !isLoggedIn() || loading || autoScanStartedRef.current) return;
    autoScanStartedRef.current = true;
    void submitScan(queryCode);
  }, [autoScan, queryCode, loading]);

  const extractRef1FromUrl = (text: string): string => {
    try {
      const url = new URL(text);
      const parts = url.pathname.replace(/^\//, "").split("/");
      if (parts.length === 2 && parts[0].length <= 5 && parts[1].length >= 6) return parts[1];
      if (parts.length === 2 && parts[0] === "s") return parts[1];
      const cParam = url.searchParams.get("code") || url.searchParams.get("c");
      if (cParam) return cParam;
    } catch { /* Not a URL */ }
    return text;
  };

  const mediaUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400"}/media/${url}`;
  };

  const handleQrScan = (decodedText: string) => {
    if (!isLoggedIn()) {
      const redirectCode = extractRef1FromUrl(decodedText);
      setPendingScan(redirectCode, "qr");
      router.push(`/login?code=${encodeURIComponent(redirectCode)}`);
      return;
    }
    const ref1 = extractRef1FromUrl(decodedText);
    setCode(ref1);
    // Delay unmount slightly so the underlying video element can settle cleanly.
    window.setTimeout(() => {
      setShowScanner(false);
      setScannerKey((prev) => prev + 1);
    }, 250);
    void submitScan(ref1);
  };

  const openQrScanner = async () => {
    if (!isLoggedIn()) {
      router.push(code.trim() ? `/login?code=${encodeURIComponent(code.trim())}` : "/login");
      return;
    }
    const liff = getLiff();
    if (liff && inLineApp) {
      try {
        const os = liff.getOS();
        if (os === "ios") { liff.openWindow({ url: "https://line.me/R/nv/QRCodeReader", external: false }); return; }
        const scanFn = (liff as any).scanCodeV2 || liff.scanCode;
        if (scanFn) { const scanResult = await scanFn(); if (scanResult?.value) { const ref1 = extractRef1FromUrl(scanResult.value); setCode(ref1); submitScan(ref1); } return; }
        liff.openWindow({ url: "https://line.me/R/nv/QRCodeReader", external: false });
      } catch { setShowScanner(true); }
    } else {
      setShowScanner(!showScanner);
    }
  };

  const submitScan = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setErrorDetail(null);
    setResult(null);
    let latitude: number | undefined;
    let longitude: number | undefined;
    try {
      const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 5000, enableHighAccuracy: false }
        );
      });
      if (coords) { latitude = coords.lat; longitude = coords.lng; }
      const isRef1 = /^[A-Za-z0-9]{6,12}$/.test(trimmed) && !trimmed.includes("-");
      const body: { code?: string; ref1?: string; latitude?: number; longitude?: number } = {};
      if (isRef1) body.ref1 = trimmed; else body.code = trimmed;
      if (latitude != null) body.latitude = latitude;
      if (longitude != null) body.longitude = longitude;
      const data = await api.post<ScanResult>("/api/v1/scan", body);
      setResult(data);
      setCode("");
      clearPendingScan();
      fetchBalances();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.data.error === "profile_incomplete") {
        setPendingScan(trimmed, "manual");
        sessionStorage.setItem("return_after_register", getPendingScanTarget("/scan"));
        router.replace("/register/complete");
        return;
      }
      if (err instanceof ApiError) {
        setError((err.data.message_th as string) || err.message || "สแกนไม่สำเร็จ");
        setErrorDetail({
          message: (err.data.message as string) || err.message || "Scan failed",
          message_th: err.data.message_th as string | undefined,
          message_en: err.data.message_en as string | undefined,
          ref1: err.data.ref1 as string | undefined,
          product_name: (err.data.product_name as string | null | undefined) ?? null,
          product_sku: (err.data.product_sku as string | null | undefined) ?? null,
          product_image_url: (err.data.product_image_url as string | null | undefined) ?? null,
        });
      } else {
        setError(err instanceof Error ? err.message : "สแกนไม่สำเร็จ");
        setErrorDetail(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn()) { setError("กรุณาเข้าสู่ระบบก่อน"); return; }
    if (!code.trim()) { setError("กรุณากรอกรหัส"); return; }
    submitScan(code);
  };

  return (
    <div className="pb-24 min-h-screen bg-background">
      <Navbar />
      {/* Header */}
      <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-10 pb-14 text-white relative overflow-hidden">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative">
          <h1 className="text-xl font-bold">สะสมแต้ม</h1>
          <p className="text-[13px] text-white/70 mt-1">สแกน QR Code หรือกรอกรหัสใต้ฝาเพื่อรับแต้ม</p>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 ring-1 ring-white/20">
            <div>
              <p className="text-[11px] text-white/60">{primaryBalance?.name || "แต้มปัจจุบัน"}</p>
              <p className="text-2xl font-bold leading-tight">{(primaryBalance?.balance ?? 0).toLocaleString()}</p>
              {secondaryBalances.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {secondaryBalances.map((item) => (
                    <span
                      key={item.currency}
                      className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white"
                    >
                      <span>{getCurrencyIcon(item.currency, item.icon)}</span>
                      <span>{item.balance.toLocaleString()} {item.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-2xl">{getCurrencyIcon(primaryBalance?.currency, primaryBalance?.icon)}</span>
          </div>
        </div>
      </div>

      {/* Scan Form */}
      <div className="px-4 -mt-6 relative z-10">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <button
              onClick={openQrScanner}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] text-[16px] font-bold text-white shadow-lg transition active:scale-[0.96] animate-pulse-glow"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM22 7h-2V4h-3V2h5v5zm0 15v-5h-2v3h-3v2h5zM2 22h5v-2H4v-3H2v5zM2 2v5h2V4h3V2H2z" />
              </svg>
              <span>สแกนคิวอาร์โค้ด</span>
            </button>

            <div className="my-4 flex items-center">
              <div className="h-px flex-1 bg-border" />
              <span className="px-3 text-xs text-muted-foreground">หรือกรอกรหัส</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                value={code}
                onChange={(e) => {
                  autoScanStartedRef.current = false;
                  setError("");
                  setErrorDetail(null);
                  setResult(null);
                  setCode(e.target.value.toUpperCase());
                }}
                maxLength={13}
                placeholder="กรอกรหัสที่นี่"
                type="text"
                spellCheck="false"
                className="h-12 w-full rounded-xl border border-input bg-muted px-4 text-center text-[15px] font-bold tracking-[0.15em] outline-none transition focus:border-[var(--jh-teal)] focus:bg-white focus:ring-2 focus:ring-[var(--jh-teal)]/30 focus:shadow-[0_0_15px_rgba(0,184,148,0.2)]"
              />
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="h-12 w-full rounded-xl bg-[var(--jh-green)] text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
              >
                {loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส"}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Result / Error */}
      {(result || error) && (
        <div className="px-4 mt-3 space-y-2">
          {result && (
            <Card className="border-0 shadow-lg overflow-hidden relative">
              {/* Confetti */}
              <div className="confetti-container">
                {[
                  { left: '10%', bg: 'var(--jh-orange)', delay: '0s', dur: '1.2s' },
                  { left: '25%', bg: 'var(--jh-purple)', delay: '0.15s', dur: '1s' },
                  { left: '40%', bg: 'var(--jh-pink)', delay: '0.3s', dur: '1.4s' },
                  { left: '55%', bg: 'var(--jh-yellow)', delay: '0.1s', dur: '1.1s' },
                  { left: '70%', bg: 'var(--jh-teal)', delay: '0.25s', dur: '1.3s' },
                  { left: '85%', bg: 'var(--jh-green)', delay: '0.05s', dur: '1s' },
                  { left: '15%', bg: 'var(--jh-gold)', delay: '0.35s', dur: '1.5s' },
                  { left: '50%', bg: 'var(--jh-pink)', delay: '0.2s', dur: '1.2s' },
                  { left: '65%', bg: 'var(--jh-orange)', delay: '0.4s', dur: '1.1s' },
                  { left: '30%', bg: 'var(--jh-purple)', delay: '0.08s', dur: '1.3s' },
                ].map((c, i) => (
                  <div key={i} className="confetti-piece" style={{ left: c.left, background: c.bg, animationDelay: c.delay, animationDuration: c.dur }} />
                ))}
              </div>
              <CardContent className="p-4 bg-[linear-gradient(135deg,#e8f5e9_0%,#f1f8e9_40%,#fffde7_100%)] relative z-10">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] shadow-md animate-scale-in">
                    <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    {result.bonus_currency_amount != null && result.bonus_currency_amount > 0 && (
                      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 animate-bounce-in">
                        <span>{result.bonus_currency_icon || getCurrencyIcon(result.bonus_currency, null)}</span>
                        <span>โบนัสพิเศษ</span>
                      </div>
                    )}

                    <p className="text-xl font-extrabold text-[var(--jh-green)] animate-count-up">
                      {result.total_points != null && result.total_points > 0
                        ? `+${result.total_points.toLocaleString()} แต้ม`
                        : result.points_earned != null && result.points_earned > 0
                          ? `+${result.points_earned.toLocaleString()} แต้ม`
                          : "สำเร็จ"}
                    </p>

                    {result.bonus_currency_amount != null && result.bonus_currency_amount > 0 ? (
                      <p className="mt-1 text-sm font-semibold text-amber-700 animate-bounce-in">
                        รับเพิ่ม {result.bonus_currency_icon || getCurrencyIcon(result.bonus_currency, null)}{" "}
                        {result.bonus_currency_amount.toLocaleString()}{" "}
                        {result.bonus_currency_name || result.bonus_currency}
                      </p>
                    ) : null}

                    {result.bonus_points != null && result.bonus_points > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-medium text-[var(--jh-green)] ring-1 ring-green-100 animate-bounce-in">
                          แต้มพื้นฐาน {result.points_earned?.toLocaleString() || 0}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100 animate-bounce-in" style={{ animationDelay: '0.1s' }}>
                          โบนัสเพิ่ม {result.bonus_points.toLocaleString()}
                        </span>
                      </div>
                    ) : null}

                    <p className="text-xs text-foreground/80 mt-2">
                      {result.message_th || "สแกนสำเร็จ"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {result.message_en || result.message}
                    </p>
                    {(result.product_name || result.product_image_url) && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-green-100 bg-white/80 p-2.5">
                        {mediaUrl(result.product_image_url) ? (
                          <img
                            src={mediaUrl(result.product_image_url) || ""}
                            alt={result.product_name || "product"}
                            className="h-14 w-14 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-green-100 text-xl">🏷️</div>
                        )}
                        <div className="min-w-0">
                          {result.ref1 && (
                            <p className="text-[11px] font-mono text-muted-foreground">{result.ref1}</p>
                          )}
                          {result.product_name && (
                            <p className="truncate text-sm font-semibold text-foreground">{result.product_name}</p>
                          )}
                          {result.product_sku && (
                            <p className="text-xs text-muted-foreground">{result.product_sku}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setResult(null)} className="text-muted-foreground">&times;</button>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50 shadow-sm animate-shake">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive">
                    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-destructive">ไม่สำเร็จ</p>
                    <p className="text-xs text-foreground/80 mt-0.5">
                      {errorDetail?.message_th || error}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {errorDetail?.message_en || errorDetail?.message || error}
                    </p>
                    {(errorDetail?.product_name || errorDetail?.product_image_url) && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-100 bg-white/80 p-2.5">
                        {mediaUrl(errorDetail?.product_image_url) ? (
                          <img
                            src={mediaUrl(errorDetail?.product_image_url) || ""}
                            alt={errorDetail.product_name || "product"}
                            className="h-14 w-14 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-red-100 text-xl">🏷️</div>
                        )}
                        <div className="min-w-0">
                          {errorDetail?.ref1 && (
                            <p className="text-[11px] font-mono text-muted-foreground">{errorDetail.ref1}</p>
                          )}
                          {errorDetail?.product_name && (
                            <p className="truncate text-sm font-semibold text-foreground">{errorDetail.product_name}</p>
                          )}
                          {errorDetail?.product_sku && (
                            <p className="text-xs text-muted-foreground">{errorDetail.product_sku}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setError(""); setErrorDetail(null); }} className="text-muted-foreground">&times;</button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* How to section */}
      {!result && !error && (
        <div className="px-4 mt-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">วิธีการสะสมแต้ม</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3 stagger-children">
              {[
                { num: "1", text: "หาคิวอาร์โค้ดบนฝาผลิตภัณฑ์ หรือในบรรจุภัณฑ์", color: "var(--jh-orange)" },
                { num: "2", text: "กดปุ่ม \"สแกนคิวอาร์โค้ด\" หรือพิมพ์รหัสด้วยตนเอง", color: "var(--jh-purple)" },
                { num: "3", text: "รับแต้มสะสมทันที! นำไปแลกของรางวัลได้", color: "var(--jh-teal)" },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-3 animate-slide-up">
                  <Badge className="mt-0.5 h-6 w-6 shrink-0 rounded-full text-white flex items-center justify-center p-0 text-xs font-bold" style={{ backgroundColor: step.color }}>
                    {step.num}
                  </Badge>
                  <p className="text-[14px] text-foreground leading-relaxed">{step.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
          <div className="w-[92%] max-w-[400px] rounded-2xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">สแกน QR Code</h3>
              <button
                onClick={() => {
                  setShowScanner(false);
                  setScannerKey((prev) => prev + 1);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-lg"
              >
                &times;
              </button>
            </div>
            <QrScanner key={scannerKey} onScan={handleQrScan} onError={(err) => setError(err)} />
            <p className="mt-2 text-center text-xs text-muted-foreground">จัดให้ QR Code อยู่ในกรอบสี่เหลี่ยม</p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ScanPageInner />
    </Suspense>
  );
}
