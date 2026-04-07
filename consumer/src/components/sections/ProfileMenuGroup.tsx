"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface MenuItem {
  href: string;
  label: string;
  icon?: string; // emoji or icon key
  color?: string;
  bg?: string;
}

interface Props {
  title?: string;
  items?: MenuItem[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
    </svg>
  ),
  docs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

const Chevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function ProfileMenuGroup({
  title = "เมนู",
  items = [],
}: Props) {
  if (!items || items.length === 0) return null;

  return (
    <div className="px-4 mt-4 animate-slide-up">
      <h3 className="text-[14px] font-bold text-muted-foreground tracking-wide ml-2 mb-2">
        {title}
      </h3>
      <Card className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          {items.map((item, i) => {
            const iconKey = item.icon || "list";
            const iconNode = ICON_MAP[iconKey] || ICON_MAP.list;
            const color = item.color || "text-[var(--jh-green)]";
            const bg = item.bg || "bg-green-50";
            return (
              <div key={`${item.href}-${i}`}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <span className={`${bg} p-2 rounded-xl border border-black/5`}>
                    <div className={color}>{iconNode}</div>
                  </span>
                  <span className="flex-1 text-[16px] font-semibold text-gray-800">
                    {item.label}
                  </span>
                  {Chevron}
                </Link>
                {i < items.length - 1 && <Separator className="ml-[60px]" />}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
