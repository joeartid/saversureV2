"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  show_use_button?: boolean;
  show_summary?: boolean;
  cta_text?: string;
  cta_link?: string;
  label?: string;
}

interface PointBalance {
  current: number;
  total_earned: number;
  total_spent: number;
}

export default function ProfilePointsCard({
  show_use_button = true,
  show_summary = true,
  cta_text = "ใช้แต้ม",
  cta_link = "/history",
  label = "แต้มสะสมใช้งานได้",
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [points, setPoints] = useState<PointBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) {
      setLoading(false);
      return;
    }
    api
      .get<PointBalance>("/api/v1/points/balance")
      .then((d) => setPoints(d))
      .catch(() => setPoints(null))
      .finally(() => setLoading(false));
  }, []);

  if (!loggedIn) return null;

  if (loading) {
    return (
      <div className="px-4 mt-4">
        <Card className="border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden rounded-2xl bg-white animate-pulse">
          <CardContent className="p-5 h-32" />
        </Card>
      </div>
    );
  }

  if (!points) return null;

  return (
    <div className="px-4 mt-4">
      <Card className="border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden rounded-2xl bg-white relative">
        {/* Subtle top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(90deg,var(--jh-green)_0%,var(--jh-lime)_100%)]" />

        <CardContent className="p-5 relative z-10 pt-6">
          <div className="flex items-end justify-between pb-5 border-b border-gray-100/80">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 mb-1 text-gray-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 text-[var(--jh-gold)] drop-shadow-sm"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.24-.97-2.31-1.8h-1.7c.07 1.69 1.11 2.76 2.81 3.14V19h2.38v-1.67c1.6-.32 2.78-1.25 2.78-2.91.01-1.89-1.48-2.7-3.66-3.21z" />
                </svg>
                <h3 className="text-[14px] font-bold tracking-wide">
                  {label}
                </h3>
              </div>
              <p className="text-[38px] leading-[1] font-black text-[var(--jh-green)] tracking-tighter drop-shadow-sm">
                {points.current.toLocaleString()}
              </p>
            </div>
            {show_use_button && (
              <Link
                href={cta_link}
                className="bg-gray-900 hover:bg-black text-white text-[14px] font-bold px-4 py-2 rounded-full shadow-sm active:scale-95 transition-all flex items-center gap-1.5 mb-1 group"
              >
                {cta_text}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
          {show_summary && (
            <div className="flex justify-between pt-4 px-1 border-t-0">
              <div className="flex flex-col gap-0.5">
                <p className="text-[14px] font-bold text-gray-400 tracking-wider">
                  ใช้ไปแล้ว
                </p>
                <p className="text-[18px] font-bold text-gray-700">
                  {points.total_spent.toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col gap-0.5 items-end">
                <p className="text-[14px] font-bold text-gray-400 tracking-wider">
                  สะสมทั้งหมด
                </p>
                <p className="text-[18px] font-black text-gray-700">
                  {points.total_earned.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
