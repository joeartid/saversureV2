"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { getPendingScanTarget, setPendingScan } from "@/lib/pendingScan";

const PRIMARY = "#1976d2";
const inputClass =
  "w-full h-[48px] px-4 border border-[var(--outline)] rounded-[var(--radius-md)] text-[14px] text-[var(--on-surface)] bg-transparent outline-none focus:border-[#1976d2] focus:border-2 transition-all";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Phone
  const [phone, setPhone] = useState("");
  const [otpId, setOtpId] = useState("");
  const [refCode, setRefCode] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Step 2: Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pdpaConsent, setPdpaConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tenantId = getTenantId() || process.env.NEXT_PUBLIC_TENANT_ID || "";
  const pendingCode = searchParams.get("code") || "";

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ otp_id: string; ref_code: string; expires_in: number }>(
        "/api/v1/otp/request",
        { phone: phone.replace(/\D/g, "") }
      );
      setOtpId(data.otp_id);
      setRefCode(data.ref_code || "");
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ไม่สามารถส่ง OTP ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!pdpaConsent) {
      setError("กรุณายอมรับนโยบาย PDPA");
      return;
    }
    setStep(3);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ access_token: string }>("/api/v1/auth/register-consumer", {
        tenant_id: tenantId,
        phone: phone.replace(/\D/g, ""),
        otp_id: otpId,
        otp_code: otpCode,
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate || undefined,
        gender: gender,
        password,
        pdpa_consent: true,
      });
      setToken(data.access_token);
      if (pendingCode) {
        setPendingScan(pendingCode, "register");
      }
      router.push(getPendingScanTarget("/scan"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ลงทะเบียนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: "ยืนยันเบอร์โทร" },
    { num: 2, label: "ข้อมูลส่วนตัว" },
    { num: 3, label: "เสร็จสิ้น" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 pt-12 pb-6">
        <Link href="/login" className="inline-flex items-center gap-2 text-[var(--on-surface-variant)] text-[14px] mb-4">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          กลับ
        </Link>
        <h1 className="text-[22px] font-semibold text-[var(--on-surface)]">ลงทะเบียนสมาชิก</h1>

        {/* Step indicator */}
        <div className="flex gap-2 mt-6">
          {steps.map((s) => (
            <div
              key={s.num}
              className={`flex-1 h-[4px] rounded-full transition-colors ${
                step >= s.num ? "bg-[#1976d2]" : "bg-[var(--outline-variant)]"
              }`}
            />
          ))}
        </div>
        <p className="text-[12px] text-[var(--on-surface-variant)] mt-2">{steps[step - 1].label}</p>
      </div>

      <div className="flex-1 px-5 pb-8">
        <div className="bg-white rounded-[var(--radius-lg)] elevation-2 p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-[var(--error-light)] rounded-[var(--radius-sm)] text-[13px] text-[var(--error)]">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  placeholder="081-234-5678"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={inputClass}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || phone.replace(/\D/g, "").length < 10}
                className="w-full h-[48px] bg-[#1976d2] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {loading ? "กำลังส่ง..." : "ส่ง OTP"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2Next} className="space-y-4">
              <p className="text-[13px] text-[var(--on-surface-variant)]">
                ส่ง OTP ไปที่ <strong>{formatPhone(phone)}</strong>
                {refCode && (
                  <span className="block mt-1 text-[11px]">Ref: {refCode}</span>
                )}
              </p>
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-1">รหัส OTP (6 หลัก)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className={`${inputClass} text-center text-[20px] tracking-[0.5em]`}
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-1">ชื่อ</label>
                <input
                  type="text"
                  placeholder="ชื่อจริง"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-1">นามสกุล</label>
                <input
                  type="text"
                  placeholder="นามสกุล"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-1">วันเกิด</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-2">เพศ</label>
                <div className="flex gap-4">
                  {(["male", "female", "other"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        checked={gender === g}
                        onChange={() => setGender(g)}
                        className="w-4 h-4 accent-[#1976d2]"
                      />
                      <span className="text-[14px] text-[var(--on-surface)]">
                        {g === "male" ? "ชาย" : g === "female" ? "หญิง" : "อื่นๆ"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-1">รหัสผ่าน (อย่างน้อย 6 ตัว)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--on-surface-variant)] mb-1">ยืนยันรหัสผ่าน</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdpaConsent}
                  onChange={(e) => setPdpaConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#1976d2]"
                />
                <span className="text-[13px] text-[var(--on-surface)]">
                  ข้าพเจ้ายอมรับ{" "}
                  <Link href="/privacy" className="text-[#1976d2] underline" target="_blank">
                    นโยบายความเป็นส่วนตัว (PDPA)
                  </Link>{" "}
                  และข้อกำหนดการใช้งาน
                </span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtpId("");
                    setOtpCode("");
                  }}
                  className="flex-1 h-[48px] border border-[var(--outline)] rounded-[var(--radius-xl)] text-[14px] font-medium text-[var(--on-surface)]"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  disabled={otpCode.length !== 6}
                  className="flex-1 h-[48px] bg-[#1976d2] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  ถัดไป
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <p className="text-[14px] text-[var(--on-surface-variant)]">
                ตรวจสอบข้อมูลของคุณและกดส่งเพื่อลงทะเบียน
              </p>
              <div className="bg-[var(--surface-container)] rounded-[var(--radius-md)] p-4 space-y-2 text-[13px]">
                <p><strong>เบอร์:</strong> {formatPhone(phone)}</p>
                <p><strong>ชื่อ:</strong> {firstName} {lastName}</p>
                <p><strong>วันเกิด:</strong> {birthDate || "-"}</p>
                <p><strong>เพศ:</strong> {gender === "male" ? "ชาย" : gender === "female" ? "หญิง" : "อื่นๆ"}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 h-[48px] border border-[var(--outline)] rounded-[var(--radius-xl)] text-[14px] font-medium text-[var(--on-surface)]"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-[48px] bg-[#1976d2] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <RegisterPageInner />
    </Suspense>
  );
}
