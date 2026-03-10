"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import BottomNav from "@/components/BottomNav";
import { api, ApiError } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { initLiff, getLiff } from "@/lib/liff";
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
  campaign_id?: string;
  message: string;
}

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
}

function ScanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [points, setPoints] = useState(0);
  const [inLineApp, setInLineApp] = useState(false);
  const autoScanStartedRef = useRef(false);
  const queryCode = resolvePendingCodeFromSearch(searchParams);
  const autoScan = searchParams.get("auto") === "1";

  const fetchPoints = useCallback(() => {
    if (isLoggedIn()) {
      api.get<PointBalance>("/api/v1/points/balance")
        .then((d) => setPoints(d.current ?? 0))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    void initLiffAndLogin();
  }, []);

  useEffect(() => {
    if (queryCode) {
      setCode(queryCode.toUpperCase());
      setPendingScan(queryCode, "qr");
    }
  }, [queryCode]);

  const initLiffAndLogin = async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) { fetchPoints(); return; }

      const liffData = await api.get<{ liff_id: string }>("/api/v1/auth/line/liff-id").catch(() => ({ liff_id: "" }));
      const liffId = liffData.liff_id;
      if (!liffId) { fetchPoints(); return; }

      const liff = await initLiff(liffId);
      if (liff.isInClient()) {
        setInLineApp(true);
      }

      if (liff.isInClient() || (liff.isLoggedIn() && !isLoggedIn())) {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const accessToken = liff.getAccessToken();
        if (accessToken && !isLoggedIn()) {
          const tokens = await api.post<{ access_token: string; profile_completed?: boolean }>("/api/v1/auth/line/liff-token", {
            access_token: accessToken,
            tenant_id: tenantId,
          });
          setToken(tokens.access_token);
          if (tokens.profile_completed === false) {
            sessionStorage.setItem("return_after_register", getPendingScanTarget("/scan"));
            router.replace("/register/complete");
            return;
          }
        }
      }
    } catch {
      // LIFF init failed, continue without it
    }
    fetchPoints();
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
    } catch {
      // Not a URL
    }
    return text;
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
    setShowScanner(false);
    submitScan(ref1);
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

        if (os === "ios") {
          liff.openWindow({
            url: "https://line.me/R/nv/QRCodeReader",
            external: false,
          });
          return;
        }

        // Android: use liff.scanCodeV2 or liff.scanCode
        const scanFn = (liff as any).scanCodeV2 || liff.scanCode;
        if (scanFn) {
          const scanResult = await scanFn();
          if (scanResult?.value) {
            const ref1 = extractRef1FromUrl(scanResult.value);
            setCode(ref1);
            submitScan(ref1);
          }
          return;
        }

        // Fallback: open LINE QR reader
        liff.openWindow({
          url: "https://line.me/R/nv/QRCodeReader",
          external: false,
        });
      } catch {
        // LIFF scan failed, fallback to html5-qrcode
        setShowScanner(true);
      }
    } else {
      setShowScanner(!showScanner);
    }
  };

  const submitScan = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
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
      if (isRef1) body.ref1 = trimmed;
      else body.code = trimmed;
      if (latitude != null) body.latitude = latitude;
      if (longitude != null) body.longitude = longitude;

      const data = await api.post<ScanResult>("/api/v1/scan", body);
      setResult(data);
      setCode("");
      clearPendingScan();
      fetchPoints();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.data.error === "profile_incomplete") {
        setPendingScan(trimmed, "manual");
        sessionStorage.setItem("return_after_register", getPendingScanTarget("/scan"));
        router.replace("/register/complete");
        return;
      }
      setError(err instanceof Error ? err.message : "สแกนไม่สำเร็จ");
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
    <div className="pb-20 min-h-screen">
      <div className="relative w-full">
        <img
          src="/assets/images/bg-collect-point.png"
          alt=""
          className="min-w-full"
          style={{ maxHeight: "650px" }}
        />
        <div className="absolute inset-0 w-full">
          <div className="pt-4 pl-5">
            <img
              src="/assets/images/logo-1x.png"
              srcSet="/assets/images/logo-1x.png, /assets/images/logo-2x.png 2x"
              alt="Jula's Herb"
              style={{ width: "95px" }}
            />
          </div>

          <div className="flex flex-col pt-2 pl-5">
            <span className="font-bold text-white text-5xl leading-none mt-1">สะสมแต้ม</span>
            <span className="text-white text-xl leading-none mt-2">
              สแกนคิวอาร์โค้ด หรือกรอกรหัสเพื่อสะสมแต้ม
            </span>
          </div>

          <div
            className="mt-4 pt-4 pb-4 flex justify-center items-center w-full"
            style={{ background: "rgba(230, 249, 233, 1)" }}
          >
            <span className="font-bold text-3xl leading-none flex items-center justify-center" style={{ color: "#3c9b4d" }}>
              แต้มสะสม {points.toLocaleString()}
              <span className="ml-2 text-xl">🪙</span>
            </span>
          </div>

          <div className="flex justify-center items-center mt-8">
            <button
              onClick={openQrScanner}
              className="flex items-center justify-center pl-2 pr-3 cursor-pointer rounded-full shadow-lg"
              style={{
                background: "#1a9444",
                height: "40px",
                boxShadow: "inset 0px 1px 0px transparent, 0px 6px 0px rgb(61, 111, 13)",
              }}
            >
              <div className="rounded-full bg-white w-8 h-8 flex justify-center items-center mr-2">
                <svg viewBox="0 0 24 24" fill="#1a9444" className="w-6 h-6">
                  <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM22 7h-2V4h-3V2h5v5zm0 15v-5h-2v3h-3v2h5zM2 22h5v-2H4v-3H2v5zM2 2v5h2V4h3V2H2z" />
                </svg>
              </div>
              <span className="text-white text-2xl" style={{ width: "8rem" }}>สแกนคิวอาร์โค้ด</span>
            </button>
          </div>

          <div className="flex flex-col justify-center items-center mt-6">
            <div className="flex flex-col items-center">
              <p className="text-white text-xl mb-2">กรุณากรอกรหัส 8 หรือ 9 หลักให้ถูกต้อง</p>
              <form onSubmit={handleSubmit} className="flex flex-col items-center">
                <input
                  value={code}
                  onChange={(e) => {
                    autoScanStartedRef.current = false;
                    setError("");
                    setResult(null);
                    setCode(e.target.value.toUpperCase());
                  }}
                  maxLength={13}
                  placeholder="กรอกรหัสสะสมแต้ม"
                  type="text"
                  spellCheck="false"
                  className="rounded-full text-center text-xl px-6 h-8 w-64 focus:outline-none"
                  style={{ color: "#3c9b4d", background: "#d3efd7" }}
                />
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="mt-4 mb-10 rounded-full text-white text-xl font-bold px-12 py-2 cursor-pointer disabled:opacity-50"
                  style={{
                    background: "#1a9444",
                    boxShadow: "inset 0px 1px 0px transparent, 0px 6px 0px rgb(61, 111, 13)",
                  }}
                >
                  {loading ? "กำลังส่ง..." : "ส่งรหัส"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-4 w-[90%] max-w-[400px]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold">สแกน QR Code</h3>
              <button onClick={() => setShowScanner(false)} className="text-2xl">&times;</button>
            </div>
            <QrScanner
              key={scannerKey}
              onScan={handleQrScan}
              onError={(err) => setError(err)}
            />
            <p className="text-sm text-center mt-2" style={{ color: "rgba(0,0,0,0.45)" }}>
              จัดให้ QR Code อยู่ในกรอบสี่เหลี่ยม
            </p>
          </div>
        </div>
      )}

      {(result || error) && (
        <div className="px-5 -mt-2 pb-6">
          {result && (
            <div className="rounded-[20px] bg-white shadow-lg border border-[#dcedd6] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "#94c945" }}>
                  <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold" style={{ color: "#3c9b4d" }}>
                    {result.points_earned != null && result.points_earned > 0 ? `+${result.points_earned} แต้ม` : "สแกนสำเร็จ"}
                  </p>
                  <p className="mt-1 text-[15px]" style={{ color: "rgba(0,0,0,0.6)" }}>{result.message}</p>
                </div>
                <button onClick={() => setResult(null)} className="text-2xl leading-none text-[#7a7a7a]">&times;</button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-[20px] bg-white shadow-lg border border-[#f4d1d4] px-5 py-4 mt-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "#FD3642" }}>
                  <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold" style={{ color: "#FD3642" }}>ไม่สำเร็จ</p>
                  <p className="mt-1 text-[15px]" style={{ color: "rgba(0,0,0,0.6)" }}>{error}</p>
                </div>
                <button onClick={() => setError("")} className="text-2xl leading-none text-[#7a7a7a]">&times;</button>
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--surface-dim)]" />}>
      <ScanPageInner />
    </Suspense>
  );
}
