"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/history", label: "สะสมแต้ม" },
  { href: "/history/redeems", label: "แลกแต้ม" },
  { href: "/history/lucky-draw", label: "ลุ้นโชค" },
  { href: "/history/donations", label: "บริจาค" },
];

export default function HistoryTabs() {
  const pathname = usePathname();

  return (
    <div className="px-4 -mt-8 relative z-10 animate-slide-up">
      <div className="bg-white rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] mb-4 overflow-hidden border border-black/5 p-1.5">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-1.5 w-max min-w-full">
            {TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex-1 rounded-full px-5 py-2 text-[13px] font-bold text-center whitespace-nowrap transition-all active:scale-95 duration-300 ${
                    isActive
                      ? "bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] text-white shadow-md shadow-green-200/50"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
