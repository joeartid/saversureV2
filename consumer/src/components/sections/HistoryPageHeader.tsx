"use client";

import { useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";

interface Props {
  title?: string;
  show_scan_count?: boolean;
  gradient_from?: string;
  gradient_to?: string;
}

interface ScansResponse {
  total?: number;
}

export default function HistoryPageHeader({
  title = "ประวัติการสะสมแต้ม",
  show_scan_count = true,
  gradient_from = "#3C9B4D",
  gradient_to = "#7DBD48",
}: Props) {
  const [total, setTotal] = useState<number>(0);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li || !show_scan_count) return;
    api
      .get<ScansResponse>("/api/v1/my/scans?limit=1&offset=0")
      .then((d) => setTotal(d.total ?? 0))
      .catch(() => {});
  }, [show_scan_count]);

  return (
    <div
      className="px-5 pt-8 pb-10 text-white relative overflow-hidden"
      style={{
        background: `linear-gradient(277.42deg, ${gradient_from} -13.4%, ${gradient_to} 80.19%)`,
      }}
    >
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 animate-float" />
      <div className="absolute right-8 bottom-3 h-16 w-16 rounded-full bg-white/5 animate-float-delay-1" />
      <div className="absolute left-10 bottom-0 h-10 w-10 rounded-full bg-white/8 animate-float-delay-2" />
      <h1 className="text-[40px] font-black tracking-tight leading-[1] mb-0 drop-shadow-md relative">
        {title}
      </h1>
      {show_scan_count && loggedIn && total > 0 && (
        <p className="text-[17px] font-medium text-white/95 -mt-1.5 relative">
          สแกน {total} ครั้ง
        </p>
      )}
    </div>
  );
}
