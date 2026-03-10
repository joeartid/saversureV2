"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "./Drawer";
import { getUser, isLoggedIn } from "@/lib/auth";
import { useTenant } from "./TenantProvider";

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const user = getUser();
  const loggedIn = isLoggedIn();
  const { brandName, branding } = useTenant();

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[999] border-b border-white/50 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[560px] items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)]/10"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div
            className="flex min-w-0 cursor-pointer items-center gap-3"
            onClick={() => router.push("/")}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
              {branding?.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={brandName}
                  className="h-7 w-7 object-contain"
                />
              ) : (
                <span className="text-sm font-bold text-[var(--primary)]">
                  {brandName.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
                {brandName}
              </p>
              <p className="truncate text-xs text-[var(--on-surface-variant)]">
                Consumer Portal
              </p>
            </div>
          </div>

          <div className="cursor-pointer" onClick={() => router.push("/profile")}>
            {loggedIn && user ? (
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)]/10">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--primary)]">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            ) : (
              <div className="rounded-full border border-[var(--outline)] px-3 py-2 text-xs font-semibold text-[var(--on-surface)]">
                Login
              </div>
            )}
          </div>
        </div>
      </header>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
