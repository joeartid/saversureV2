"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTenant } from "@/components/TenantProvider";

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
}

interface ProfileData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  profile_completed?: boolean;
}

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [points, setPoints] = useState(0);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const { brandName } = useTenant();

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

  const displayName = useMemo(() => {
    if (!profile) return "ผู้ใช้งาน";
    return (
      profile.display_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      "ผู้ใช้งาน"
    );
  }, [profile]);

  const quickLinks = [
    { href: "/scan", title: "สแกนสะสมแต้ม", subtitle: "สแกนคิวอาร์หรือกรอกรหัสด้วยตนเอง" },
    { href: "/history", title: "ประวัติการสแกน / แต้ม", subtitle: "ดูรายการสะสมแต้มล่าสุดของคุณ" },
    { href: "/history/redeems", title: "ประวัติการแลกแต้ม", subtitle: "ติดตามคูปองและของรางวัลที่แลกไป" },
    { href: "/rewards", title: "ช้อปออนไลน์", subtitle: "พื้นที่สำหรับ commerce และแคตตาล็อกในอนาคต" },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbf4_0%,#ffffff_44%)] pb-28">
      <Navbar />

      <div className="mx-auto max-w-[560px] px-4 pt-20">
        <div className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-dark,#245c31)_100%)] px-5 pb-6 pt-6 text-white shadow-[0_24px_60px_rgba(31,85,45,0.22)]">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">
            {brandName}
          </p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight">
            {loggedIn ? `สวัสดี ${displayName}` : "เริ่มสะสมแต้มกับแบรนด์ของคุณ"}
          </h1>
          <p className="mt-2 text-sm text-white/80">
            portal ใหม่สำหรับสแกนสินค้า ดูประวัติสะสมแต้ม แลกสิทธิพิเศษ และต่อยอดไปยังบริการอื่นของ consumer
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] bg-white/14 px-4 py-4 ring-1 ring-white/15">
              <p className="text-xs uppercase tracking-[0.16em] text-white/65">แต้มคงเหลือ</p>
              <p className="mt-2 text-3xl font-bold">{points.toLocaleString()}</p>
            </div>
            <div className="rounded-[24px] bg-white/14 px-4 py-4 ring-1 ring-white/15">
              <p className="text-xs uppercase tracking-[0.16em] text-white/65">สถานะสมาชิก</p>
              <p className="mt-2 text-lg font-semibold">
                {loggedIn ? (profile?.profile_completed ? "พร้อมสแกนต่อ" : "รอกรอกข้อมูลเพิ่ม") : "Guest"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-white/60 bg-white/90 p-4 shadow-[0_20px_50px_rgba(18,52,29,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[var(--on-surface)]">Quick Actions</p>
              <p className="text-sm text-[var(--on-surface-variant)]">ไปยัง flow หลักของลูกค้าได้ทันที</p>
            </div>
            {!loggedIn && (
              <Link
                href="/login"
                className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[22px] border border-[var(--outline-variant)] bg-white px-4 py-4 transition hover:border-[var(--primary)]/30"
              >
                <p className="text-base font-semibold text-[var(--on-surface)]">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{item.subtitle}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-[28px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_50px_rgba(18,52,29,0.08)]">
            <p className="text-lg font-semibold text-[var(--on-surface)]">ประสบการณ์ใหม่ของ Consumer</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-[var(--surface-container,#f5f7f4)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--on-surface)]">Auth-first</p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  สแกนจาก QR แล้วพาเข้า branded auth landing ก่อน หากยังไม่ได้ login
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container,#f5f7f4)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--on-surface)]">Scan stays in portal</p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  เมื่อสแกนซ้ำหรือสแกนสำเร็จ ผลลัพธ์จะอยู่ในหน้า `/scan` หน้าเดียว ไม่หลุด context
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container,#f5f7f4)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--on-surface)]">Portal-ready</p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  โครงนี้รองรับต่อยอดไปยัง history, redeem, profile และ online ordering ได้ทันที
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-dashed border-[var(--outline)] bg-white/80 p-5 text-center">
            <p className="text-base font-semibold text-[var(--on-surface)]">Online Ordering Placeholder</p>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              พื้นที่นี้เตรียมไว้สำหรับ catalog, order history และ campaign commerce ใน iteration ถัดไป
            </p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
