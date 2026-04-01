"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";

const FAQS = [
  { q: "แต้มมีวันหมดอายุหรือไม่?", a: "แต้มสะสมมีอายุ 1 ปีปฏิทิน และจะหมดอายุในวันที่ 31 ธันวาคมของปีถัดไปจากการสะสม" },
  { q: "สแกนคิวอาร์โค้ดแล้วแต้มไม่ขึ้น ทำอย่างไร?", a: "เบื้องต้นโปรดตรวจสอบสัญญาณอินเทอร์เน็ต และลองสแกนอีกครั้ง หากยังไม่สำเร็จ โปรดกดที่เมนู 'แจ้งปัญหาการใช้งาน'" },
  { q: "ของรางวัลจัดส่งเมื่อไหร่?", a: "ของรางวัลจะถูกจัดส่งภายใน 7-14 วันทำการหลังจากการแลกคะแนนสำเร็จ" }
];

export default function FAQPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <PageHeader title="ศูนย์ช่วยเหลือ" subtitle="คำถามที่พบบ่อย (FAQ)" backHref="/support" />

      <div className="px-4 mt-6">
        <h2 className="text-[14px] font-bold text-gray-800 mb-3 ml-2">หมวดหมู่คำถามที่พบบ่อย</h2>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {FAQS.map((faq, i) => (
            <div key={i} className="group">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex justify-between items-center p-4 text-left focus:outline-none"
              >
                <span className={`text-[14px] font-medium pr-4 ${openIdx === i ? "text-[var(--jh-green)]" : "text-gray-700"}`}>
                  {faq.q}
                </span>
                <span className="shrink-0">
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${openIdx === i ? "rotate-180 text-[var(--jh-green)]" : "text-gray-400"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIdx === i ? "max-h-40 opacity-100 pb-4 px-4" : "max-h-0 opacity-0 px-4"
                }`}
              >
                <div className="text-[13px] text-gray-500 leading-relaxed border-l-2 border-[var(--jh-green)] pl-3 ml-1">
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 bg-gray-50 rounded-2xl p-6 text-center shadow-inner">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-purple-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-800">ไม่พบคำตอบที่ต้องการ?</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">ติดต่อหน่วยงานบริการลูกค้าเพื่อสอบถามเพิ่มเติม</p>
          <button className="rounded-full bg-purple-500 text-white font-bold text-[13px] px-6 py-2 shadow-md shadow-purple-200" onClick={() => window.location.href = "/support"}>
            แจ้งปัญหาการใช้งาน
          </button>
        </div>
      </div>
    </div>
  );
}
