"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default function SupportPage() {
  return (
    <div className="pb-28">
      <Navbar />
      <div className="pt-16">
        <div
          className="px-5 pt-6 pb-4"
          style={{ background: "var(--green-gradient)" }}
        >
          <h1 className="text-3xl font-bold text-white">แจ้งปัญหา</h1>
        </div>

        <div className="px-4 pt-4">
          <div className="bg-white rounded-lg p-6 text-center elevation-1">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{ background: "rgba(148, 201, 69, 0.15)" }}
            >
              <svg viewBox="0 0 24 24" fill="#3c9b4d" className="w-8 h-8">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </div>
            <p className="text-xl font-bold" style={{ color: "#3c9b4d" }}>ติดต่อเรา</p>
            <p className="text-lg mt-2" style={{ color: "rgba(0,0,0,0.45)" }}>
              หากมีปัญหาเกี่ยวกับการสะสมแต้ม<br />
              กรุณาติดต่อทีมงาน
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
