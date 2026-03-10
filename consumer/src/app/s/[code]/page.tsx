"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";
import { initLiff } from "@/lib/liff";
import { getTenantId } from "@/lib/tenant";
import { getPendingScanTarget, setPendingScan } from "@/lib/pendingScan";

export default function ScanCodePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [phase, setPhase] = useState<"checking" | "redirecting">("checking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (code) {
      setPendingScan(code, "qr");
    }
    void prepareAndRedirect();
  }, [code]);

  const goToScanPage = () => {
    router.replace(getPendingScanTarget("/scan"));
  };

  const prepareAndRedirect = async () => {
    if (isLoggedIn()) {
      goToScanPage();
      return;
    }

    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        setPhase("redirecting");
        router.replace(`/login?code=${encodeURIComponent(code)}`);
        return;
      }

      const liffData = await api.get<{ liff_id: string }>("/api/v1/auth/line/liff-id").catch(() => ({ liff_id: "" }));
      if (!liffData.liff_id) {
        setPhase("redirecting");
        router.replace(`/login?code=${encodeURIComponent(code)}`);
        return;
      }

      const liff = await initLiff(liffData.liff_id);
      if (!liff.isLoggedIn()) {
        setPhase("redirecting");
        router.replace(`/login?code=${encodeURIComponent(code)}`);
        return;
      }

      const accessToken = liff.getAccessToken();
      if (!accessToken) {
        setPhase("redirecting");
        router.replace(`/login?code=${encodeURIComponent(code)}`);
        return;
      }

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
      goToScanPage();
    } catch {
      setPhase("redirecting");
      router.replace(`/login?code=${encodeURIComponent(code)}`);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(to bottom, #e6f9e9, #ffffff)" }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-6">
            <img
              src="/assets/images/logo-drawer.png"
              srcSet="/assets/images/logo-drawer.png, /assets/images/logo-drawer-2x.png 2x"
              alt="Jula's Herb"
              className="mx-auto mb-3"
              style={{ height: "40px" }}
            />
            <p className="text-sm mt-1" style={{ color: "rgba(0,0,0,0.45)" }}>
              สแกน QR Code เพื่อสะสมแต้ม
            </p>
          </div>

          <div className="rounded-lg p-3 mb-5 text-center" style={{ background: "#e6f9e9" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "#3c9b4d" }}>Code</p>
            <p className="font-mono text-sm break-all mt-1" style={{ color: "#333" }}>
              {code}
            </p>
          </div>

          {(phase === "checking" || phase === "redirecting") && (
            <div className="text-center py-8">
              <div
                className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                style={{ borderColor: "#3c9b4d", borderTopColor: "transparent" }}
              />
              <p className="text-sm" style={{ color: "rgba(0,0,0,0.45)" }}>
                {errorMsg || "กำลังเตรียมเส้นทางเข้าสู่ระบบและหน้าสแกน..."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
