"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

interface ScanResult {
  status: string;
  points_earned?: number;
  campaign_id?: string;
  message: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"qr" | "manual">("qr");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "getting" | "ok" | "denied">("idle");
  const [scannerKey, setScannerKey] = useState(0);

  const extractRef1FromUrl = (text: string): string => {
    try {
      const url = new URL(text);
      // V2 format: qr.svsu.me/{shortcode}/{ref1}
      const parts = url.pathname.replace(/^\//, "").split("/");
      if (parts.length === 2 && parts[0].length <= 5 && parts[1].length >= 6) {
        return parts[1];
      }
      // Legacy format: /s/{code}
      if (parts.length === 2 && parts[0] === "s") {
        return parts[1];
      }
      // Query format: ?code=X
      const codeParam = url.searchParams.get("code");
      if (codeParam) return codeParam;
    } catch {
      // Not a URL — treat as raw code/ref1
    }
    return text;
  };

  const handleQrScan = (decodedText: string) => {
    if (!isLoggedIn()) {
      localStorage.setItem("scan_redirect_code", extractRef1FromUrl(decodedText));
      router.push("/login");
      return;
    }
    const ref1 = extractRef1FromUrl(decodedText);
    setCode(ref1);
    setMode("manual");
    submitScan(ref1);
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
        setLocationStatus("getting");
        if (!navigator.geolocation) {
          setLocationStatus("denied");
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocationStatus("ok");
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            setLocationStatus("denied");
            resolve(null);
          },
          { timeout: 5000, enableHighAccuracy: false }
        );
      });

      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }

      const isRef1 = /^[A-Za-z0-9]{6,12}$/.test(trimmed) && !trimmed.includes("-");
      const body: { code?: string; ref1?: string; latitude?: number; longitude?: number } = {};
      if (isRef1) {
        body.ref1 = trimmed;
      } else {
        body.code = trimmed;
      }
      if (latitude != null) body.latitude = latitude;
      if (longitude != null) body.longitude = longitude;

      const data = await api.post<ScanResult>("/api/v1/scan", body);
      setResult(data);
      setCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "สแกนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      setError("กรุณาเข้าสู่ระบบก่อน");
      return;
    }
    if (!code.trim()) {
      setError("กรุณากรอกรหัส");
      return;
    }
    submitScan(code);
  };

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-[var(--primary)] to-[#1557b0] text-white px-5 pt-12 pb-6 rounded-b-[24px]">
        <h1 className="text-[22px] font-semibold">Scan QR Code</h1>
        <p className="text-[13px] opacity-80 mt-1">Scan or enter code to earn points</p>
      </div>

      <div className="px-5 mt-6">
        {/* Mode toggle */}
        <div className="flex bg-[var(--surface-container)] rounded-[var(--radius-xl)] p-1 mb-6">
          <button
            onClick={() => setMode("qr")}
            className={`flex-1 h-[36px] rounded-[var(--radius-xl)] text-[13px] font-medium transition-all ${
              mode === "qr" ? "bg-white elevation-1 text-[var(--primary)]" : "text-[var(--on-surface-variant)]"
            }`}
          >
            สแกน QR
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 h-[36px] rounded-[var(--radius-xl)] text-[13px] font-medium transition-all ${
              mode === "manual" ? "bg-white elevation-1 text-[var(--primary)]" : "text-[var(--on-surface-variant)]"
            }`}
          >
            กรอกรหัส
          </button>
        </div>

        {mode === "qr" ? (
          <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-4">
            <QrScanner
              key={scannerKey}
              onScan={handleQrScan}
              onError={(err) => setError(err)}
            />
            <p className="text-[12px] text-[var(--on-surface-variant)] mt-3 text-center">
              จัดให้ QR Code อยู่ในกรอบสี่เหลี่ยม
            </p>
            {result && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-sm text-green-700 font-medium">สแกนสำเร็จ! +{result.points_earned} คะแนน</p>
              </div>
            )}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={() => { setError(""); setScannerKey(k => k + 1); }}
                  className="mt-2 text-xs text-[var(--primary)] underline"
                >
                  สแกนอีกครั้ง
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-5">
            <form onSubmit={handleSubmit}>
              <label className="block text-[12px] font-medium text-[var(--on-surface-variant)] mb-2 uppercase tracking-wider">
                รหัส QR หรือ Ref1
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4E5"
                className="w-full h-[52px] px-4 border-2 border-[var(--outline)] rounded-[var(--radius-md)] text-[16px] font-mono text-center tracking-[2px] outline-none focus:border-[var(--primary)] transition-colors"
                required
                autoFocus
              />
              {locationStatus === "getting" && (
                <p className="text-[12px] text-[var(--on-surface-variant)] mt-2">กำลังขอตำแหน่ง...</p>
              )}
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full h-[48px] mt-4 bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    กำลังสแกน...
                  </span>
                ) : (
                  "สแกน"
                )}
              </button>
            </form>
            <p className="text-[12px] text-[var(--on-surface-variant)] mt-3 text-center">
              <button
                type="button"
                onClick={() => setMode("qr")}
                className="text-[var(--primary)] underline"
              >
                สแกนด้วยกล้อง
              </button>
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-4 bg-[var(--success-light)] border border-[var(--success)] rounded-[var(--radius-lg)] p-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-[var(--success)] flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            {result.points_earned != null && result.points_earned > 0 && (
              <p className="text-[18px] font-semibold text-[var(--success)]">+{result.points_earned} คะแนน!</p>
            )}
            <p className="text-[13px] text-[var(--on-surface-variant)] mt-1">{result.message}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-[var(--error-light)] border border-[var(--error)] rounded-[var(--radius-lg)] p-4 text-center">
            <p className="text-[14px] font-medium text-[var(--error)]">{error}</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
