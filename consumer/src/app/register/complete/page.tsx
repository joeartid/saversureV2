"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";
import { getPendingScanTarget } from "@/lib/pendingScan";

const inputClass =
  "w-full h-[48px] px-4 border border-[var(--outline)] rounded-[12px] text-[16px] text-[var(--on-surface)] bg-white outline-none focus:border-[var(--primary)] focus:border-2 transition-all font-[var(--font-body)]";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface ProfileData {
  display_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  profile_completed?: boolean;
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [refCode, setRefCode] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    api
      .get<ProfileData>("/api/v1/profile")
      .then((p) => {
        if (p.profile_completed) {
          router.replace("/");
          return;
        }
        if (p.display_name) {
          const parts = p.display_name.split(" ");
          if (!firstName) setFirstName(parts[0] || "");
          if (!lastName && parts.length > 1) setLastName(parts.slice(1).join(" "));
        }
        if (p.email && !email) setEmail(p.email);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const handleRequestOTP = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ otp_id: string; ref_code: string }>("/api/v1/otp/request", {
        phone: phone.replace(/\D/g, ""),
      });
      setOtpId(data.otp_id);
      setRefCode(data.ref_code || "");
      setOtpSent(true);
      setOtpCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ไม่สามารถส่ง OTP ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (phone.replace(/\D/g, "").length < 10) {
        setError("กรุณากรอกเบอร์โทรให้ครบ 10 หลัก");
        return;
      }
      if (!firstName.trim()) {
        setError("กรุณากรอกชื่อ");
        return;
      }
      if (!otpSent) {
        setError("กรุณาขอ OTP ก่อน");
        return;
      }
      setStep(2);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ access_token: string; profile_completed: boolean }>(
        "/api/v1/profile/complete",
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.replace(/\D/g, ""),
          otp_id: otpId,
          otp_code: otpCode,
          email: email.trim() || undefined,
        }
      );
      if (data.access_token) {
        setToken(data.access_token);
      }
      const returnUrl = sessionStorage.getItem("return_after_register");
      sessionStorage.removeItem("return_after_register");
      router.replace(returnUrl || getPendingScanTarget("/scan"));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.data.error === "phone_exists") {
        setError("เบอร์นี้ถูกใช้แล้ว กรุณาติดต่อ Admin");
      } else {
        setError(err instanceof Error ? err.message : "ลงทะเบียนไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-dim)]">
        <div className="text-[var(--on-surface-variant)] text-[16px]">กำลังตรวจสอบ...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-dim)] flex flex-col">
      {/* Header */}
      <div className="bg-[var(--primary)] text-white px-5 pt-12 pb-6 rounded-b-[24px]">
        <h1 className="text-[24px] font-bold">ลงทะเบียนสมาชิก</h1>
        <p className="text-[14px] mt-1 opacity-80">
          กรอกข้อมูลเพื่อเริ่มสะสมแต้ม
        </p>
      </div>

      {/* Step indicator */}
      <div className="px-5 mt-4 flex gap-2">
        <div className={`flex-1 h-[4px] rounded-full ${step >= 1 ? "bg-[var(--primary)]" : "bg-[var(--outline)]"}`} />
        <div className={`flex-1 h-[4px] rounded-full ${step >= 2 ? "bg-[var(--primary)]" : "bg-[var(--outline)]"}`} />
      </div>
      <p className="px-5 text-[12px] text-[var(--on-surface-variant)] mt-1">
        {step === 1 ? "ข้อมูลส่วนตัว" : "ยืนยัน OTP"}
      </p>

      <form onSubmit={handleSubmit} className="flex-1 px-5 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-[var(--error-light)] rounded-[12px] text-[14px] text-[var(--error)]">
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div>
              <label className="block text-[13px] text-[var(--on-surface-variant)] mb-1">ชื่อจริง *</label>
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
              <label className="block text-[13px] text-[var(--on-surface-variant)] mb-1">นามสกุล *</label>
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
              <label className="block text-[13px] text-[var(--on-surface-variant)] mb-1">เบอร์โทรศัพท์ *</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="081-234-5678"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={`${inputClass} flex-1`}
                  required
                />
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  disabled={loading || phone.replace(/\D/g, "").length < 10 || otpCooldown > 0}
                  className="h-[48px] px-4 bg-[var(--primary)] text-white rounded-[12px] text-[14px] font-medium whitespace-nowrap disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {otpCooldown > 0 ? `${otpCooldown}s` : otpSent ? "ส่งใหม่" : "ขอ OTP"}
                </button>
              </div>
              {otpSent && refCode && (
                <p className="text-[12px] text-[var(--success)] mt-1">
                  ส่ง OTP แล้ว (Ref: {refCode})
                </p>
              )}
            </div>
            <div>
              <label className="block text-[13px] text-[var(--on-surface-variant)] mb-1">อีเมล (ไม่บังคับ)</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={!firstName.trim() || phone.replace(/\D/g, "").length < 10 || !otpSent}
              className="w-full h-[52px] bg-[var(--primary)] text-white rounded-[24px] text-[16px] font-bold disabled:opacity-50 active:scale-[0.98] transition-all mt-4"
            >
              ถัดไป
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-white rounded-[16px] p-5 shadow-sm space-y-3">
              <h3 className="text-[16px] font-bold text-[var(--on-surface)]">ตรวจสอบข้อมูล</h3>
              <div className="text-[14px] text-[var(--on-surface)] space-y-1">
                <p><span className="text-[var(--on-surface-variant)]">ชื่อ:</span> {firstName} {lastName}</p>
                <p><span className="text-[var(--on-surface-variant)]">เบอร์:</span> {formatPhone(phone)}</p>
                {email && <p><span className="text-[var(--on-surface-variant)]">อีเมล:</span> {email}</p>}
              </div>
            </div>
            <div>
              <label className="block text-[13px] text-[var(--on-surface-variant)] mb-1">รหัส OTP (6 หลัก)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} text-center text-[24px] tracking-[0.5em]`}
                required
              />
              {refCode && (
                <p className="text-[12px] text-[var(--on-surface-variant)] mt-1">Ref: {refCode}</p>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setStep(1); setError(""); }}
                className="flex-1 h-[52px] border border-[var(--outline)] rounded-[24px] text-[15px] font-medium text-[var(--on-surface)]"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="flex-1 h-[52px] bg-[var(--primary)] text-white rounded-[24px] text-[16px] font-bold disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {loading ? "กำลังลงทะเบียน..." : "ยืนยัน"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
