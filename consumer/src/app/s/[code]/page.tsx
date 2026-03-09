"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";

interface ScanResult {
  status: string;
  ref1?: string;
  points_earned: number;
  bonus_points: number;
  total_points: number;
  bonus_currency?: string;
  bonus_currency_amount?: number;
  campaign_id: string;
  message: string;
}

export default function ScanCodePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [phase, setPhase] = useState<"checking" | "login" | "scanning" | "success" | "error">("checking");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lineLoading, setLineLoading] = useState(false);
  const [displayCode, setDisplayCode] = useState(code);

  // Detect if code looks like ref1 (alphanumeric, no dash/prefix) vs compact HMAC code
  const isRef1Like = /^[A-Za-z0-9]{6,12}$/.test(code) && !code.includes("-");

  useEffect(() => {
    if (isRef1Like) {
      setDisplayCode(code);
    } else {
      api.get<{ ref1: string }>(`/api/v1/public/resolve-ref1?code=${encodeURIComponent(code)}`)
        .then((d) => { if (d.ref1) setDisplayCode(d.ref1); })
        .catch(() => {});
    }

    if (isLoggedIn()) {
      doScan();
    } else {
      setPhase("login");
    }
  }, []);

  const doScan = async () => {
    setPhase("scanning");
    try {
      const body = isRef1Like ? { ref1: code } : { code };
      const data = await api.post<ScanResult>("/api/v1/scan", body);
      setResult(data);
      setPhase("success");
    } catch (err: unknown) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "สแกนไม่สำเร็จ");
    }
  };

  const handleLineLogin = async () => {
    setLineLoading(true);
    setErrorMsg("");
    try {
      const tenantId = getTenantId();
      const url = tenantId
        ? `/api/v1/auth/line?tenant_id=${encodeURIComponent(tenantId)}`
        : "/api/v1/auth/line";
      const data = await api.get<{ url: string }>(url);
      localStorage.setItem("scan_redirect_code", code);
      window.location.href = data.url;
    } catch {
      setErrorMsg("LINE Login ยังไม่พร้อมใช้งาน");
      setLineLoading(false);
    }
  };

  const handleEmailLogin = () => {
    localStorage.setItem("scan_redirect_code", code);
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-blue-600">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Saversure</h1>
            <p className="text-sm text-gray-500 mt-1">สแกน QR Code เพื่อสะสมแต้ม</p>
          </div>

          {/* Code display */}
          <div className="bg-gray-50 rounded-lg p-3 mb-5 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Code</p>
            <p className="font-mono text-sm text-gray-800 break-all mt-1">
              {result?.ref1 || displayCode}
            </p>
          </div>

          {/* Phase: Checking */}
          {phase === "checking" && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-600 text-sm">กำลังตรวจสอบ...</p>
            </div>
          )}

          {/* Phase: Login required */}
          {phase === "login" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center mb-4">เข้าสู่ระบบเพื่อรับแต้มสะสม</p>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-sm text-red-600">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleLineLogin}
                disabled={lineLoading}
                className="w-full h-12 bg-[#06C755] text-white font-medium rounded-xl hover:bg-[#05b34c] disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {lineLoading ? (
                  "กำลังเชื่อมต่อ LINE..."
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                    </svg>
                    เข้าสู่ระบบด้วย LINE
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">หรือ</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button
                onClick={handleEmailLogin}
                className="w-full h-12 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition text-sm"
              >
                เข้าสู่ระบบด้วย Email
              </button>
            </div>
          )}

          {/* Phase: Scanning */}
          {phase === "scanning" && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-600 text-sm">กำลังตรวจสอบ QR Code...</p>
            </div>
          )}

          {/* Phase: Success */}
          {phase === "success" && result && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-green-600">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-green-700">สแกนสำเร็จ!</h2>
              <div className="mt-4 bg-green-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-green-700">{result.total_points}</p>
                <p className="text-sm text-green-600 mt-1">แต้มที่ได้รับ</p>
                {result.bonus_points > 0 && (
                  <p className="text-xs text-green-500 mt-2">
                    (แต้มปกติ {result.points_earned} + โบนัส {result.bonus_points})
                  </p>
                )}
                {result.bonus_currency_amount && result.bonus_currency_amount > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    + {result.bonus_currency_amount} {result.bonus_currency}
                  </p>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-4">{result.message}</p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 h-10 px-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium transition"
              >
                ไปหน้าหลัก
              </button>
            </div>
          )}

          {/* Phase: Error */}
          {phase === "error" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-red-600">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-red-700">ไม่สำเร็จ</h2>
              <p className="text-sm text-red-600 mt-2">{errorMsg}</p>
              <button
                onClick={() => { setPhase(isLoggedIn() ? "checking" : "login"); setErrorMsg(""); if (isLoggedIn()) doScan(); }}
                className="mt-4 h-10 px-6 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition"
              >
                ลองใหม่
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by Saversure V2
        </p>
      </div>
    </div>
  );
}
