"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default function NewsPage() {
  return (
    <div className="pb-28">
      <Navbar />
      <div className="pt-16">
        <div
          className="px-5 pt-6 pb-4"
          style={{ background: "var(--green-gradient)" }}
        >
          <h1 className="text-3xl font-bold text-white">กิจกรรม</h1>
        </div>

        <div className="px-4 pt-4">
          <div className="bg-white rounded-lg p-6 text-center elevation-1">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{ background: "rgba(148, 201, 69, 0.15)" }}
            >
              <svg viewBox="0 0 24 24" fill="#3c9b4d" className="w-8 h-8">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10 0h2v2h-2v-2zm-6-4h8v2h-8v-2z" />
              </svg>
            </div>
            <p className="text-xl font-bold" style={{ color: "#3c9b4d" }}>ยังไม่มีกิจกรรม</p>
            <p className="text-lg mt-1" style={{ color: "rgba(0,0,0,0.45)" }}>
              ติดตามกิจกรรมดีๆ ได้เร็วๆ นี้
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
