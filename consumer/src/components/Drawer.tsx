"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTenant } from "./TenantProvider";

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
}

const menuItems = [
  {
    label: "หน้าหลัก",
    href: "/",
    icon: (
      <svg viewBox="0 0 24 24" fill="#35974D" className="w-4 h-4">
        <path d="M12 3l9 7h-2v9h-5v-6H10v6H5v-9H3l9-7z" />
      </svg>
    ),
  },
  {
    label: "สแกนสะสมแต้ม",
    href: "/scan",
    icon: (
      <svg viewBox="0 0 24 24" fill="#35974D" className="w-4 h-4">
        <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5z" />
      </svg>
    ),
  },
  {
    label: "ประวัติการสะสมแต้ม",
    href: "/history",
    icon: (
      <svg viewBox="0 0 24 24" fill="#35974D" className="w-4 h-4">
        <path d="M13 3a9 9 0 100 18 9 9 0 000-18zm1 10h-5V7h2v4h3v2z" />
      </svg>
    ),
  },
  {
    label: "ประวัติการแลกแต้ม",
    href: "/history/redeems",
    icon: (
      <svg viewBox="0 0 24 24" fill="#35974D" className="w-4 h-4">
        <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
      </svg>
    ),
  },
  {
    label: "แจ้งปัญหา / ติดต่อเรา",
    href: "/support",
    icon: (
      <svg viewBox="0 0 24 24" fill="#35974D" className="w-4 h-4">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
      </svg>
    ),
  },
];

export default function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const user = getUser();
  const loggedIn = isLoggedIn();
  const [points, setPoints] = useState(0);
  const { brandName, branding } = useTenant();

  useEffect(() => {
    if (open && loggedIn) {
      api.get<PointBalance>("/api/v1/points/balance")
        .then((d) => setPoints(d.current ?? 0))
        .catch(() => {});
    }
  }, [open, loggedIn]);

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/75"
          onClick={onClose}
        />
      )}

      <div
        className="fixed top-0 h-full bg-white z-[9999] transition-all duration-500 shadow-[0_24px_60px_rgba(0,0,0,0.16)]"
        style={{
          width: "78%",
          maxWidth: "320px",
          left: open ? 0 : "-100%",
        }}
      >
        <div className="bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-dark,#245c31)_100%)] px-4 pb-5 pt-8 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt={brandName} className="h-8 w-8 object-contain" />
              ) : (
                <span className="text-lg font-bold">{brandName.slice(0, 1)}</span>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Portal</p>
              <p className="text-lg font-semibold">{brandName}</p>
            </div>
          </div>
        </div>

        <div
          className="m-4 flex cursor-pointer items-center rounded-[24px] bg-[var(--surface-container,#f5f7f4)] p-4"
          onClick={() => navigate("/profile")}
        >
          <div className="mr-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)]/10">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[var(--primary)]">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="flex flex-col w-full">
            <p className="text-base font-semibold leading-none">
              {loggedIn ? `สมาชิก ${user?.user_id?.slice(0, 8) ?? ""}` : "Guest"}
            </p>
            <div className="mt-1 flex items-baseline">
              <p className="text-3xl font-bold leading-none" style={{ color: "#3c9b4d" }}>
                {points.toLocaleString()}
              </p>
              <span className="text-sm ml-1" style={{ color: "#3c9b4d" }}>แต้ม</span>
            </div>
          </div>
          <div className="flex w-6 justify-end">
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
              <path d="M1 9L5 5L1 1" stroke="black" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="px-3">
        {menuItems.map((item) => (
          <div
            key={item.href}
            className="flex cursor-pointer items-center rounded-2xl p-4 hover:bg-gray-50"
            onClick={() => navigate(item.href)}
          >
            <div className="mr-4">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "rgba(148, 201, 69, 0.15)" }}
              >
                {item.icon}
              </div>
            </div>
            <span className="text-lg w-full">{item.label}</span>
            <div className="flex w-12 justify-end">
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                <path d="M1 9L5 5L1 1" stroke="black" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        ))}
        </div>
      </div>
    </>
  );
}
