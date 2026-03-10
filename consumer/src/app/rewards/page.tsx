"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default function RewardsPage() {
  return (
    <div className="pb-28">
      <Navbar />
      <div className="pt-16">
        <div
          className="px-5 pt-6 pb-4"
          style={{ background: "var(--green-gradient)" }}
        >
          <h1 className="text-3xl font-bold text-white">ช้อปออนไลน์</h1>
        </div>

        <div className="px-4 pt-4">
          <div className="bg-white rounded-lg p-6 text-center elevation-1">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{ background: "rgba(148, 201, 69, 0.15)" }}
            >
              <svg viewBox="0 0 24 24" fill="#3c9b4d" className="w-8 h-8">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </div>
            <p className="text-xl font-bold" style={{ color: "#3c9b4d" }}>เร็วๆ นี้</p>
            <p className="text-lg mt-1" style={{ color: "rgba(0,0,0,0.45)" }}>
              ช้อปออนไลน์กำลังจะเปิดให้บริการเร็วๆ นี้
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
