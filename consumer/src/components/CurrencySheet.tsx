"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCurrencies } from "@/lib/currency-context";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CurrencySheet({ open, onClose }: Props) {
  const { balances, primary, loggedIn, loading } = useCurrencies();

  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="กระเป๋าแต้มของคุณ"
        className={`fixed bottom-0 left-1/2 w-full max-w-[480px] z-[1001] bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? "-translate-x-1/2 translate-y-0" : "-translate-x-1/2 translate-y-full"
        }`}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="text-[20px] font-bold text-gray-900">
            กระเป๋าแต้มของคุณ
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="py-10 text-center text-gray-400">กำลังโหลด…</div>
          ) : !loggedIn ? (
            <div className="py-8 text-center space-y-4">
              <div className="text-5xl">🔒</div>
              <p className="text-gray-600">เข้าสู่ระบบเพื่อดูแต้มสะสมของคุณ</p>
              <Link
                href="/login"
                onClick={onClose}
                className="inline-block px-6 py-2.5 rounded-full bg-[var(--jh-green,#3C9B4D)] text-white font-bold shadow-sm active:scale-95 transition-transform"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          ) : balances.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              ยังไม่มีสกุลแต้มในระบบ
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {balances.map((b) => {
                const isPrimary = primary?.currency === b.currency;
                return (
                  <li
                    key={b.currency}
                    className={`flex items-center gap-3 py-3 ${
                      isPrimary ? "bg-[#f5fbf4] -mx-2 px-2 rounded-xl" : ""
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-2xl shrink-0">
                      {b.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 truncate">
                          {b.name}
                        </span>
                        {isPrimary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--jh-green,#3C9B4D)] text-white">
                            หลัก
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-gray-500">
                        รวมสะสม {b.earned.toLocaleString()} · ใช้แล้ว{" "}
                        {b.spent.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-black text-gray-900 leading-none">
                        {b.balance.toLocaleString()}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {loggedIn && balances.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3">
            <Link
              href="/wallet"
              onClick={onClose}
              className="block w-full text-center py-2.5 rounded-full bg-[var(--jh-green,#3C9B4D)] text-white font-bold shadow-sm active:scale-[0.98] transition-transform"
            >
              ดูประวัติทั้งหมด
            </Link>
          </div>
        )}

        {/* safe area */}
        <div className="pb-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </>
  );
}
