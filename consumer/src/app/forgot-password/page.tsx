"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/tenant";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const tenantId = getTenantId() || process.env.NEXT_PUBLIC_TENANT_ID || "";

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [otpId, setOtpId] = useState("");
  const [refCode, setRefCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const inputClass =
    "h-12 w-full rounded-2xl border border-[var(--outline)] bg-white px-4 text-[14px] outline-none transition focus:border-[var(--primary)]";

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setError("ยังไม่พบ tenant ของแบรนด์นี้");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ otp_id: string; ref_code: string }>(
        "/api/v1/auth/password/request",
        {
          tenant_id: tenantId,
          phone: phone.replace(/\D/g, ""),
        }
      );
      setOtpId(data.otp_id);
      setRefCode(data.ref_code);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ไม่สามารถส่ง OTP ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setError("ยังไม่พบ tenant ของแบรนด์นี้");
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("ยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post("/api/v1/auth/password/reset", {
        tenant_id: tenantId,
        phone: phone.replace(/\D/g, ""),
        otp_id: otpId,
        otp_code: otpCode,
        new_password: password,
      });
      setSuccess("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--surface-dim)_0%,#ffffff_50%)] px-5 py-6">
      <div className="mx-auto max-w-[520px]">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-[var(--on-surface-variant)]"
        >
          <span>←</span>
          <span>กลับไปหน้าเข้าสู่ระบบ</span>
        </Link>

        <div className="mt-4 overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-dark,#245c31)_100%)] px-5 py-6 text-white shadow-[0_24px_60px_rgba(31,85,45,0.24)]">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">
            Forgot Password
          </p>
          <h1 className="mt-2 text-2xl font-bold">รีเซ็ตรหัสผ่านด้วย OTP</h1>
          <p className="mt-2 text-sm text-white/80">
            ใช้เบอร์โทรศัพท์ที่ผูกกับบัญชีของคุณเพื่อยืนยันตัวตน
          </p>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_50px_rgba(18,52,29,0.12)]">
          {error && (
            <div className="mb-4 rounded-2xl border border-[var(--error)]/20 bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--on-surface)]">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  value={formatPhone(phone)}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="081-234-5678"
                  className={inputClass}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || phone.replace(/\D/g, "").length < 10}
                className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "กำลังส่ง OTP..." : "ส่ง OTP"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="rounded-2xl bg-[var(--surface-container,#f5f7f4)] px-4 py-3 text-sm text-[var(--on-surface)]">
                <p>เบอร์โทร: {formatPhone(phone)}</p>
                {refCode && (
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    Ref: {refCode}
                  </p>
                )}
              </div>

              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="รหัส OTP 6 หลัก"
                className={`${inputClass} text-center tracking-[0.35em]`}
                maxLength={6}
                required
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่"
                className={inputClass}
                required
              />

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่านใหม่"
                className={inputClass}
                required
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-12 flex-1 rounded-2xl border border-[var(--outline)] text-sm font-semibold text-[var(--on-surface)]"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="h-12 flex-1 rounded-2xl bg-[var(--primary)] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
