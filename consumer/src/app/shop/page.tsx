"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <div className="pt-24">
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-12 text-white relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
          <h1 className="text-xl font-bold relative">🛒 ช้อปออนไลน์</h1>
          <p className="text-[13px] text-white/70 mt-1 relative">สินค้าจุฬาเฮิร์บ ส่งตรงถึงบ้าน</p>
        </div>

        <div className="px-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-[var(--jh-green-light)] flex items-center justify-center mb-4 animate-float">
              <span className="text-4xl">🏗️</span>
            </div>
            <h2 className="text-lg font-bold text-foreground">เร็วๆ นี้</h2>
            <p className="text-sm text-muted-foreground mt-2 text-center leading-relaxed">
              ร้านค้าออนไลน์กำลังเตรียมพร้อม<br />
              สินค้าจุฬาเฮิร์บคุณภาพ ส่งตรงถึงบ้านคุณ
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
