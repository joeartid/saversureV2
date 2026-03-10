"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import {
  getPendingScanTarget,
  setPendingScan,
} from "@/lib/pendingScan";
import { Suspense } from "react";

function LineCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const stateParam = searchParams.get("state");

    if (errorParam) {
      setError("LINE Login ถูกยกเลิก");
      return;
    }

    if (!code) {
      setError("ไม่พบรหัสยืนยันจาก LINE");
      return;
    }

    const tenantId = getTenantId() || "00000000-0000-0000-0000-000000000001";

    api
      .post<{ access_token: string; profile_completed?: boolean }>("/api/v1/auth/line/callback", {
        code,
        tenant_id: tenantId,
      })
      .then((data) => {
        setToken(data.access_token);
        const redirectCodeFromState = stateParam?.includes("|") ? stateParam.split("|").slice(1).join("|") : "";
        const redirectCode = redirectCodeFromState || "";
        if (redirectCode) {
          setPendingScan(redirectCode, "line");
        }
        if (data.profile_completed === false) {
          sessionStorage.setItem("return_after_register", getPendingScanTarget("/scan"));
          router.push("/register/complete");
          return;
        }
        if (redirectCode) {
          router.push(getPendingScanTarget("/scan"));
        } else {
          router.push("/scan");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "LINE Login ล้มเหลว");
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--surface-dim)]">
        <div className="bg-white rounded-[var(--radius-lg)] elevation-2 p-8 text-center max-w-sm w-full">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--error)] flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[var(--error)] mb-2">เข้าสู่ระบบไม่สำเร็จ</p>
          <p className="text-[13px] text-[var(--on-surface-variant)] mb-4">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full h-[44px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[14px] font-medium"
          >
            กลับไปหน้า Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--surface-dim)]">
      <div className="bg-white rounded-[var(--radius-lg)] elevation-2 p-8 text-center max-w-sm w-full">
        <div className="w-10 h-10 mx-auto border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[15px] font-medium text-[var(--on-surface)]">กำลังเข้าสู่ระบบด้วย LINE...</p>
        <p className="text-[12px] text-[var(--on-surface-variant)] mt-1">กรุณารอสักครู่</p>
      </div>
    </div>
  );
}

export default function LineCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--surface-dim)]">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LineCallbackInner />
    </Suspense>
  );
}
