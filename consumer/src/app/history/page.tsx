"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";

interface HistoryEntry {
  id: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  description?: string;
  created_at: string;
  reference_type?: string;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (li) {
      api.get<{ entries: HistoryEntry[] }>("/api/v1/points/history?limit=50")
        .then((d) => setEntries(d.entries ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="pb-28">
      <Navbar />
      <div className="pt-16">
        {/* Header */}
        <div
          className="px-5 pt-6 pb-4"
          style={{ background: "var(--green-gradient)" }}
        >
          <h1 className="text-3xl font-bold text-white">ประวัติการสะสมแต้ม</h1>
        </div>

        <div className="px-4 pt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : !loggedIn ? (
            <div className="bg-white rounded-lg p-6 text-center elevation-1">
              <p className="text-lg" style={{ color: "rgba(0,0,0,0.45)" }}>
                กรุณาเข้าสู่ระบบเพื่อดูประวัติ
              </p>
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center elevation-1">
              <p className="text-lg" style={{ color: "rgba(0,0,0,0.45)" }}>
                ยังไม่มีประวัติการสะสมแต้ม
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-white rounded-lg p-4 elevation-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-lg font-bold">
                        {entry.entry_type === "credit" ? "สะสมแต้ม" : "ใช้แต้ม"}
                      </p>
                      <p className="text-sm" style={{ color: "rgba(0,0,0,0.45)" }}>
                        {entry.description || "-"}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.35)" }}>
                        {formatDate(entry.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-2xl font-bold"
                        style={{ color: entry.entry_type === "credit" ? "#3c9b4d" : "#FD3642" }}
                      >
                        {entry.entry_type === "credit" ? "+" : "-"}{entry.amount}
                      </p>
                      <p className="text-xs" style={{ color: "rgba(0,0,0,0.35)" }}>
                        คงเหลือ {entry.balance_after}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
