"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { isLoggedIn, logout } from "@/lib/auth";
import { api } from "@/lib/api";

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
}

interface ProfileData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  profile_completed?: boolean;
  phone_verified?: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [points, setPoints] = useState(0);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (li) {
      api.get<PointBalance>("/api/v1/points/balance")
        .then((d) => setPoints(d.current ?? 0))
        .catch(() => {});
      api.get<ProfileData>("/api/v1/profile")
        .then((d) => setProfile(d))
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbf4_0%,#ffffff_44%)] pb-28">
      <Navbar />
      <div className="mx-auto max-w-[560px] px-4 pt-20">
        <div className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-dark,#245c31)_100%)] px-5 pb-6 pt-6 text-white shadow-[0_24px_60px_rgba(31,85,45,0.22)]">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">My Profile</p>
          <h1 className="mt-2 text-[28px] font-bold">บัญชีของฉัน</h1>
          <p className="mt-2 text-sm text-white/80">
            จัดการข้อมูลสมาชิก ดูสถานะการยืนยัน และเข้าถึงเมนูหลักของ consumer portal
          </p>
        </div>

        <div className="mt-5">
          {loggedIn ? (
            <>
              <div className="rounded-[28px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_50px_rgba(18,52,29,0.08)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/10">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[var(--primary)]">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[var(--on-surface)]">
                      {profile?.display_name ||
                        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
                        "สมาชิก"}
                    </p>
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {profile?.email || profile?.phone || "บัญชีผู้ใช้งาน"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[var(--surface-container,#f5f7f4)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">แต้มคงเหลือ</p>
                    <p className="mt-2 text-3xl font-bold text-[#3c9b4d]">
                      {points.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container,#f5f7f4)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">สถานะโปรไฟล์</p>
                    <p className="mt-2 text-base font-semibold text-[var(--on-surface)]">
                      {profile?.profile_completed ? "ข้อมูลครบแล้ว" : "ยังต้องยืนยันเพิ่มเติม"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                      {profile?.phone_verified ? "เบอร์โทรยืนยันแล้ว" : "ยังไม่ยืนยันเบอร์โทร"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div
                  className="flex cursor-pointer items-center rounded-[24px] border border-white/60 bg-white/90 p-4 shadow-[0_20px_50px_rgba(18,52,29,0.08)]"
                  onClick={() => router.push("/history")}
                >
                  <div
                    className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: "rgba(148, 201, 69, 0.15)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="#35974D" className="w-4 h-4">
                      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                    </svg>
                  </div>
                  <span className="text-base font-medium text-[var(--on-surface)] flex-1">ประวัติสะสมแต้ม</span>
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                    <path d="M1 9L5 5L1 1" stroke="black" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <div
                  className="flex cursor-pointer items-center rounded-[24px] border border-white/60 bg-white/90 p-4 shadow-[0_20px_50px_rgba(18,52,29,0.08)]"
                  onClick={() => router.push("/scan")}
                >
                  <div
                    className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: "rgba(148, 201, 69, 0.15)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="#35974D" className="w-4 h-4">
                      <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5z" />
                    </svg>
                  </div>
                  <span className="text-base font-medium text-[var(--on-surface)] flex-1">ไปหน้าสแกนหลัก</span>
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                    <path d="M1 9L5 5L1 1" stroke="black" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {!profile?.profile_completed && (
                  <div
                    className="flex cursor-pointer items-center rounded-[24px] border border-amber-200 bg-amber-50 p-4"
                    onClick={() => router.push("/register/complete")}
                  >
                    <div className="flex-1">
                      <p className="text-base font-semibold text-amber-900">กรอกข้อมูลสมาชิกให้ครบ</p>
                      <p className="mt-1 text-sm text-amber-700">
                        ยืนยันเบอร์โทรและข้อมูลพื้นฐานก่อนเริ่มสแกนสะสมแต้ม
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => logout()}
                className="mt-6 w-full rounded-[24px] border-2 border-[#FD3642] bg-white py-3 text-base font-bold text-[#FD3642]"
              >
                ออกจากระบบ
              </button>
            </>
          ) : (
            <div className="rounded-[28px] border border-white/60 bg-white/90 p-6 text-center shadow-[0_20px_50px_rgba(18,52,29,0.08)]">
              <p className="text-lg" style={{ color: "rgba(0,0,0,0.45)" }}>
                กรุณาเข้าสู่ระบบ
              </p>
              <button
                onClick={() => router.push("/login")}
                className="mt-3 px-8 py-2 rounded-full text-white text-lg font-bold"
                style={{ background: "#1a9444" }}
              >
                เข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
