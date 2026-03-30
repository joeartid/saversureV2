"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

export default function ShopPage() {
  const links = [
    {
      title: "Julaherb_officialshop",
      href: "https://shopee.co.th/julaherb_officialshop",
      icon: (
        <div className="w-12 h-12 bg-[#EE4D2D] rounded-xl flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden">
          {/* Shopee Bag Icon */}
          <div className="absolute inset-0 bg-white/20 mt-6 rounded-full blur-sm" />
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 relative z-10">
            <path d="M6.5 8.5C6.5 5.5 8.5 3.5 12 3.5C15.5 3.5 17.5 5.5 17.5 8.5L20.5 8.5C21.05 8.5 21.5 8.95 21.5 9.5L19.5 20.5C19.5 21.05 19.05 21.5 18.5 21.5L5.5 21.5C4.95 21.5 4.5 21.05 4.5 20.5L2.5 9.5C2.5 8.95 2.95 8.5 3.5 8.5L6.5 8.5ZM12 5.5C10 5.5 8.5 7 8.5 8.5L15.5 8.5C15.5 7 14 5.5 12 5.5ZM13 11.5C13 12.05 12.55 12.5 12 12.5C11.45 12.5 11 12.05 11 11.5L11 10.5C11 9.95 11.45 9.5 12 9.5C12.55 9.5 13 9.95 13 10.5L13 11.5ZM12 13.5C12.55 13.5 13 13.95 13 14.5L13 15.5C13 16.05 12.55 16.5 12 16.5C11.45 16.5 11 16.05 11 15.5L11 14.5C11 13.95 11.45 13.5 12 13.5Z" />
            <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#EE4D2D" transform="translate(0,0)">S</text>
          </svg>
        </div>
      ),
      borderColor: "border-[#EE4D2D]",
    },
    {
      title: "Jula's Herb",
      href: "https://www.lazada.co.th/shop/julas-herb",
      icon: (
        <div className="w-12 h-12 bg-gradient-to-br from-[#0F146D] to-[#1a237e] rounded-xl flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden">
          <div className="absolute -left-2 -bottom-2 w-10 h-10 bg-[#f57c00] rounded-full blur-md opacity-80" />
          <div className="absolute -right-2 -top-2 w-10 h-10 bg-[#e91e63] rounded-full blur-md opacity-80" />
          <span className="text-white font-black text-[15px] tracking-tighter relative z-10 italic drop-shadow-md">Laz</span>
        </div>
      ),
      borderColor: "border-[#0F146D]",
    },
    {
      title: "www.julaherbshop.com",
      href: "https://www.julaherbshop.com",
      icon: (
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(26,148,68,0.15)] relative overflow-hidden">
          <svg viewBox="0 0 24 24" fill="var(--jh-green)" className="w-8 h-8">
            <path d="M17 8C8 10 5.9 16.1 5.1 19l1.4 1.3C7.4 14.2 13.4 12 17 8z" />
            <path d="M17 8c-3-2.6-8.9-3.4-12.7-1.1L5.6 8A13.4 13.4 0 0117 8z" opacity="0.6" />
            <path d="M17 8c1.7 4 1 9.7-2 12.8A13.8 13.8 0 0017 8z" opacity="0.8" />
          </svg>
        </div>
      ),
      borderColor: "border-[var(--jh-green)]",
    },
    {
      title: "ติดตะกร้าจุฬาเฮิร์บ (LINE OpenChat)",
      href: "https://line.me/th/",
      icon: (
        <div className="w-12 h-12 bg-[#00B900] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
            <path d="M21.5 10.3c0-4.6-4.3-8.3-9.5-8.3-5.2 0-9.5 3.7-9.5 8.3 0 4.1 3.4 7.6 8.1 8.2.3 0 .8.1 1 .3.1.2.1.8 0 1.2L11 21.6c0 .3.2.4.4.3 2.1-1.3 6.9-4.2 8.7-6.5 1-1.4 1.4-3.2 1.4-5.1z" />
          </svg>
        </div>
      ),
      borderColor: "border-[#00B900]",
    },
    {
      title: "สั่งซื้อที่แอดมิน",
      href: "https://line.me/R/ti/p/@julaherb",
      icon: (
        <div className="w-12 h-12 bg-[#00B900] rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm">
          <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 -mb-1">
            <path d="M21.5 10.3c0-4.6-4.3-8.3-9.5-8.3-5.2 0-9.5 3.7-9.5 8.3 0 4.1 3.4 7.6 8.1 8.2.3 0 .8.1 1 .3.1.2.1.8 0 1.2L11 21.6c0 .3.2.4.4.3 2.1-1.3 6.9-4.2 8.7-6.5 1-1.4 1.4-3.2 1.4-5.1z" />
          </svg>
          <span className="text-white font-extrabold text-[9px] tracking-wider mt-0.5">LINE</span>
        </div>
      ),
      borderColor: "border-[#00B900]",
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      <div className="pt-24">
        {/* Custom Header with very large font and green background matching the theme */}
        <div className="bg-[linear-gradient(277.42deg,#3C9B4D_-13.4%,#7DBD48_80.19%)] px-5 pt-8 pb-10 text-white relative overflow-hidden">
          {/* Abstract Leaf Graphics Background */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <svg viewBox="0 0 200 200" fill="none" className="absolute top-0 right-0 w-64 h-64 opacity-20">
              <path d="M100 10 C 150 10, 190 50, 190 100 C 190 150, 100 190, 10 100 C 10 50, 50 10, 100 10 Z" fill="#ffffff" />
            </svg>
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 animate-float" />
            <div className="absolute left-10 bottom-2 h-16 w-16 rounded-full bg-white/5 animate-float-delay-1" />
          </div>

          <div className="relative z-10 flex flex-col items-start">
            <h1 className="text-[40px] font-black tracking-tight leading-[1] mb-0 drop-shadow-md">ช้อปออนไลน์</h1>
            <p className="text-[17px] font-medium text-white/95 -mt-1.5">เลือกซื้อสินค้าออนไลน์กับเราได้ที่นี่เลย</p>
          </div>
        </div>

        {/* Content area: light white/gray background */}
        <div className="px-5 -mt-6 relative z-10">
          <div className="w-full flex flex-col gap-3.5">
            {links.map((link, i) => (
              <Link 
                key={i} 
                href={link.href}
                target="_blank"
                className={`bg-white rounded-[20px] p-2 flex items-center pr-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border-[2px] ${link.borderColor} transition-transform active:scale-[0.97] animate-slide-up hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)]`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {link.icon}
                <span className="font-extrabold text-[16px] text-gray-800 ml-4 flex-1">
                  {link.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
