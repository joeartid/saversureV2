"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useTenant } from "@/components/TenantProvider";

export default function LoginPage() {
  const { tenantId, brandName } = useTenant();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLineLogin = async () => {
    setLineLoading(true);
    setError("");
    try {
      const url = tenantId
        ? `/api/v1/auth/line?tenant_id=${encodeURIComponent(tenantId)}`
        : "/api/v1/auth/line";
      const data = await api.get<{ url: string }>(url);
      window.location.href = data.url;
    } catch {
      setError("LINE Login ยังไม่พร้อมใช้งาน");
      setLineLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        await api.post("/api/v1/auth/register", {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone,
        });
      }
      const data = await api.post<{ access_token: string }>("/api/v1/auth/login", { email, password });
      setToken(data.access_token);
      const redirectCode = localStorage.getItem("scan_redirect_code");
      if (redirectCode) {
        localStorage.removeItem("scan_redirect_code");
        router.push(`/s/${redirectCode}`);
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full h-[48px] px-4 border border-[var(--outline)] rounded-[var(--radius-md)] text-[14px] text-[var(--on-surface)] bg-transparent outline-none focus:border-[var(--primary)] focus:border-2 transition-all";

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-[var(--surface-dim)]">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto rounded-[var(--radius-lg)] bg-[var(--primary)] flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
          </svg>
        </div>
        <h1 className="text-[22px] font-semibold text-[var(--on-surface)]">{brandName}</h1>
        <p className="text-[13px] text-[var(--on-surface-variant)] mt-1">Scan & Earn Rewards</p>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-[var(--surface-container)] rounded-[var(--radius-xl)] p-1 mb-6">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 h-[36px] rounded-[var(--radius-xl)] text-[13px] font-medium transition-all ${
            mode === "login" ? "bg-white elevation-1 text-[var(--primary)]" : "text-[var(--on-surface-variant)]"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => setMode("register")}
          className={`flex-1 h-[36px] rounded-[var(--radius-xl)] text-[13px] font-medium transition-all ${
            mode === "register" ? "bg-white elevation-1 text-[var(--primary)]" : "text-[var(--on-surface-variant)]"
          }`}
        >
          Register
        </button>
      </div>

      <div className="bg-white rounded-[var(--radius-lg)] elevation-2 p-6">
        {error && (
          <div className="mb-4 p-3 bg-[var(--error-light)] rounded-[var(--radius-sm)] text-[13px] text-[var(--error)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
              <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </>
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required minLength={6} />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>

      {/* LINE Login */}
      <div className="mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--outline-variant)]" />
          <span className="text-[12px] text-[var(--on-surface-variant)]">หรือ</span>
          <div className="flex-1 h-px bg-[var(--outline-variant)]" />
        </div>
        <button
          onClick={handleLineLogin}
          disabled={lineLoading}
          className="w-full h-[48px] bg-[#06C755] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
      </div>

      <div className="flex justify-center gap-4 mt-4">
        <Link href="/otp" className="text-[13px] text-[var(--primary)]">
          ยืนยันหมายเลขโทรศัพท์ด้วย OTP
        </Link>
        <Link href="/register" className="text-[13px] text-[var(--primary)]">
          ลงทะเบียนสมาชิกใหม่
        </Link>
      </div>
      <p className="text-center text-[11px] text-[var(--on-surface-variant)] mt-6 opacity-60">
        Powered by Saversure v2.0
      </p>
    </div>
  );
}
