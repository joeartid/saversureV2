"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "หน้าหลัก",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M12 3l9 7h-2v9h-5v-6H10v6H5v-9H3l9-7z" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "ประวัติ",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M13 3a9 9 0 100 18 9 9 0 000-18zm1 10h-5V7h2v4h3v2z" />
      </svg>
    ),
  },
  {
    href: "/scan",
    label: "สะสมแต้ม",
    isCenter: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  },
  {
    href: "/rewards",
    label: "แลกแต้ม",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "โปรไฟล์",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5zm0 2c-3.33 0-8 1.67-8 5v1h16v-1c0-3.33-4.67-5-8-5z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/60 bg-white/92 backdrop-blur">
      <div className="relative mx-auto flex h-[68px] max-w-[560px] items-end">
        {tabs.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

          if (tab.isCenter) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-1 flex-col items-center justify-end pb-[6px]"
                style={{ height: "68px" }}
              >
                <div
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    width: "56px",
                    height: "56px",
                    top: "-28px",
                    background: "var(--scan-btn-gradient)",
                    boxShadow: "4px 4px 25px rgba(148, 201, 69, 0.45)",
                  }}
                >
                  {tab.icon}
                </div>
                <div style={{ height: "24px" }} />
                <span
                  className="text-xs"
                  style={{ color: isActive ? "var(--primary)" : "rgba(0,0,0,0.45)" }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <span
                    className="absolute top-0 rounded-b-full"
                    style={{ width: "40px", height: "4px", background: "var(--primary)" }}
                  />
                )}
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex h-[68px] flex-1 flex-col items-center justify-center"
              style={{ color: isActive ? "var(--primary)" : "rgba(0,0,0,0.45)" }}
            >
              {tab.icon}
              <span className="text-xs mt-0.5">{tab.label}</span>
              {isActive && (
                <span
                  className="absolute top-0 rounded-b-full"
                  style={{ width: "40px", height: "4px", background: "var(--primary)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
