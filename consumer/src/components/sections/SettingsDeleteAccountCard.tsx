"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface SettingsDeleteAccountCardProps {
  group_title?: string;
  button_label?: string;
  warning_text?: string;
  cta_href?: string;
}

export default function SettingsDeleteAccountCard({
  group_title = "ลบบัญชีผู้ใช้",
  button_label = "แจ้งขอลบบัญชีผู้ใช้",
  warning_text = "หากลบบัญชี แต้มและข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้",
  cta_href = "",
}: SettingsDeleteAccountCardProps) {
  const inner = (
    <div className="w-full flex items-center justify-between p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-red-50 p-2 rounded-lg text-red-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5"
          >
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <span className="text-[14px] font-bold">{button_label}</span>
      </div>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-4 h-4 text-red-300"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  );

  return (
    <div className="px-4 mt-4">
      <h2 className="text-[14px] font-bold text-gray-800 mb-2 ml-2 mt-2">
        {group_title}
      </h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-1">
          {cta_href ? (
            <Link href={cta_href} className="block">
              {inner}
            </Link>
          ) : (
            <button className="w-full text-left">{inner}</button>
          )}
        </CardContent>
      </Card>
      {warning_text && (
        <p className="text-[11px] text-gray-400 mt-2 ml-2 px-1">
          {warning_text}
        </p>
      )}
    </div>
  );
}
