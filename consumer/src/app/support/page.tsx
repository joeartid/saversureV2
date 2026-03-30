"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

const FAQ_ITEMS = [
  {
    q: "แต้มสะสมจะหมดอายุเมื่อไหร่?",
    a: "แต้มสะสมมีอายุตามที่แบรนด์กำหนด กรุณาตรวจสอบในหน้ากระเป๋าเงินหรือติดต่อทีมงาน",
  },
  {
    q: "สแกน QR แล้วไม่ได้แต้ม?",
    a: "อาจเกิดจาก QR ถูกสแกนไปแล้วหรือหมดอายุ กรุณาตรวจสอบประวัติการสแกนหรือแจ้งปัญหาผ่านแบบฟอร์มด้านล่าง",
  },
  {
    q: "แลกของรางวัลแล้วจะได้รับเมื่อไหร่?",
    a: "ระยะเวลาจัดส่งขึ้นอยู่กับประเภทของรางวัล คูปองจะได้รับทันที สินค้าจัดส่งภายใน 7-14 วันทำการ",
  },
  {
    q: "เปลี่ยนเบอร์โทรศัพท์ได้อย่างไร?",
    a: "ไปที่หน้าโปรไฟล์ แล้วกดแก้ไขข้อมูลส่วนตัว หากมีปัญหาให้แจ้งทีมงาน",
  },
];

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm border border-gray-100/80 overflow-hidden transition-all"
        >
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-white transition hover:bg-gray-50 active:bg-gray-100"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--jh-green)]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
              </svg>
            </div>
            <span className="flex-1 text-[13px] font-semibold text-gray-800">{item.q}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                openIdx === i ? "rotate-180" : ""
              }`}
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openIdx === i && (
            <div className="px-4 pb-3.5 pl-14 -mt-1 bg-white">
              <p className="text-[12px] text-gray-500 leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar />

      <div className="pt-24">
        {/* Header */}
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-10 text-white relative overflow-hidden">
          <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 animate-float" />
          <div className="absolute right-10 bottom-2 h-14 w-14 rounded-full bg-white/5 animate-float-delay-1" />
          <div className="absolute left-8 bottom-0 h-10 w-10 rounded-full bg-white/8 animate-float-delay-2" />

          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h1 className="text-[40px] font-black tracking-tight leading-[1] mb-0 drop-shadow-md">คำถามที่พบบ่อย</h1>
              <p className="text-[17px] font-medium text-white/95 -mt-1.5">รวมคำตอบและวิธีการใช้งานเบื้องต้น</p>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="px-4 -mt-6 relative z-10 space-y-4">
          <div className="animate-slide-up">
            <FAQSection />

            {/* CTA to create ticket */}
            <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100/80 p-5 text-center">
              <p className="text-[13px] text-gray-600">ไม่พบคำตอบที่ต้องการ หรือต้องการแจ้งปัญหา?</p>
              <Link
                href="/support/history?tab=ticket"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-green-200/50 transition-all active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                ไปหน้าแจ้งปัญหา
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
