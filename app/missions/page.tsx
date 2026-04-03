"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MissionHubPage() {
  const [activeTab, setActiveTab] = useState("active");
  const [activeFilter, setActiveFilter] = useState("all");
  const router = useRouter();

  const filterCategories = [
    { id: "all", label: "ทั้งหมด" },
    { id: "product", label: "สินค้า" },
    { id: "category", label: "หมวดหมู่ / แบรนด์" },
    { id: "channel", label: "ช่องทางที่ซื้อ" },
    { id: "time", label: "ช่วงเวลา / วัน" },
    { id: "routine", label: "สกินแคร์ รูทีน" },
    { id: "shopping", label: "ช้อปปิ้งออนไลน์" },
  ];

  const allMissions = [
    {
      id: 1,
      type: "product",
      title: "สแกนดีดีครีมครบ 6 ซอง",
      desc: "1 ซอง = 1 ดวง (สะสมได้เรื่อยๆ)",
      progress: 2,
      max: 6,
      timeLeft: "เหลืออีก 15 วัน",
      badgeText: "ลด 40.-",
      badgeSub: "ส่วนลด",
      badgeBg: "bg-[#ffebee]",
      badgeColor: "text-[#d32f2f]",
      badgeOutline: "border-[#f44336]", 
      nodes: 6
    },
    {
      id: 2,
      type: "channel",
      title: "ซื้อสินค้าที่ 7-11 อัปใบเสร็จ",
      desc: "ส่งหลักฐานการซื้อผ่านเมนูรับแต้ม",
      progress: 0,
      max: 1,
      timeLeft: "เหลืออีก 5 วัน",
      badgeText: "รับ20แต้ม",
      badgeSub: "แต้มพิเศษ",
      badgeBg: "bg-[#e8f5e9]",
      badgeColor: "text-[#2e7d32]",
      badgeOutline: "border-[#4caf50]",
      nodes: 2
    },
    {
      id: 3,
      type: "time",
      title: "สแกนเสาร์-อาทิตย์ ครบ 5 ครั้ง",
      desc: "สะสมยอดแกนเฉพาะวันหยุด Weekend",
      progress: 3,
      max: 5,
      timeLeft: "เหลืออีก 2 วัน",
      badgeText: "1 ตั๋ว",
      badgeSub: "ลุ้นโชค",
      badgeBg: "bg-[#e3f2fd]",
      badgeColor: "text-[#1976d2]",
      badgeOutline: "border-[#1e88e5]", 
      nodes: 5
    },
    {
      id: 4,
      type: "routine",
      title: "สแกนตามรูทีน 4 step ตัวไหนก็ได้",
      desc: "ล้าง > บำรุง > กันแดด > แต้มสิว",
      progress: 1,
      max: 4,
      timeLeft: "ตลอดปี",
      badgeText: "100แต้ม",
      badgeSub: "Bonus",
      badgeBg: "bg-[#fce4ec]",
      badgeColor: "text-[#c2185b]",
      badgeOutline: "border-[#ec407a]", 
      nodes: 4
    },
    {
      id: 5,
      type: "category",
      title: "สแกนครบ set แตงโม ตัวไหนก็ได้",
      desc: "เจลแต้มสิว, ดีดีครีม, โลชั่น, สบู่",
      progress: 0,
      max: 4,
      timeLeft: "เหลืออีก 30 วัน",
      badgeText: "+50แต้ม",
      badgeSub: "Watermelon",
      badgeBg: "bg-[#fff8e1]",
      badgeColor: "text-[#f57c00]", 
      badgeOutline: "border-[#ff9800]", 
      nodes: 4
    },
    {
      id: 6,
      type: "shopping",
      title: "ซื้อสินค้าในแอป ครบ 3 ครั้ง",
      desc: "รวมสินค้าทุกประเภทในแอป",
      progress: 1,
      max: 3,
      timeLeft: "สิ้นเดือนนี้",
      badgeText: "ลด 15%",
      badgeSub: "Coupon",
      badgeBg: "bg-[#f3e5f5]",
      badgeColor: "text-[#7b1fa2]", 
      badgeOutline: "border-[#ab47bc]", 
      nodes: 3
    }
  ];

  const campaigns = [
    {
      id: 1,
      name: "สะแกนสะสมแต้ม ดีดีครีมแตงโม ครบ 6 ชิ้น",
      description: "เพียงสแกนสะสมแต้ม ดีดีครีมแตงโม ครบ 6 ชิ้น ริบแต้มฟรี 20 แต้ม",
      image_url: "https://shop.julasherb.in.th/wp-content/uploads/2021/04/0J5A1303-1-300x300.jpg",
      progress: 0,
      max: 6,
      timeLeft: "เหลืออีก 7 วัน",
      reward: "20 แต้ม ส่วนลด"
    },
    {
      id: 2,
      name: "นักสแกนมือใหม่",
      description: "สแกน QR Code ครบ 3 ครั้ง",
      image_url: "https://shop.julasherb.in.th/wp-content/uploads/2021/04/0J5A1312-300x300.jpg",
      progress: 0,
      max: 3,
      timeLeft: "เหลืออีก 57 วัน",
      reward: "20 แต้ม แต้มพิเศษ"
    },
    {
      id: 3,
      name: "นักสะสมตัวยง",
      description: "สแกน QR Code ครบ 10 ครั้ง",
      image_url: "https://shop.julasherb.in.th/wp-content/uploads/2023/07/Lotion_Shopee1.jpg",
      progress: 0,
      max: 10,
      timeLeft: "เหลืออีก 57 วัน",
      reward: "50 แต้ม ลุ้นโชค"
    }
  ];

  const displayMissions = activeFilter === 'all' 
    ? allMissions 
    : allMissions.filter(m => m.type === activeFilter);

  const CampaignCard = ({ campaign }: { campaign: any }) => {
    const percent = (campaign.progress / campaign.max) * 100;
    
    return (
      <div className="bg-white rounded-[16px] p-4 flex items-center justify-between border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all cursor-pointer group hover:border-purple-300">
        {/* Left Side */}
        <div className="flex-1 flex flex-col pt-1 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-purple-100 text-purple-600 text-[9px] font-bold px-2 py-0.5 rounded-full">แคมเปญพิเศษ</div>
          </div>
          <h3 className="font-bold text-[14.5px] text-gray-800 tracking-tight leading-snug">{campaign.name}</h3>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{campaign.description}</p>
          
          <div className="mt-4 mb-2 w-full relative h-[6px] bg-gray-100 rounded-full flex items-center">
            <div className="absolute top-0 left-0 h-full bg-purple-500 rounded-full transition-all duration-700 shadow-sm" style={{ width: `${percent}%` }}></div>
          </div>
          
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 mt-1.5">
            <span className="font-bold text-gray-700">{campaign.progress}/{campaign.max}</span>
            <span className="text-orange-600 font-bold">{campaign.timeLeft}</span>
          </div>
        </div>

        {/* Right Side (Image & Reward) */}
        <div className="w-[70px] h-[70px] flex items-center justify-center shrink-0">
          <div className="w-full h-full rounded-full border-[3px] border-purple-200 flex flex-col items-center justify-center relative overflow-hidden shadow-sm bg-purple-50">
            <div className="absolute inset-0 bg-white/40"></div>
            <div className="relative z-10 font-black text-center text-purple-600">
              <div className="text-[10px] leading-none tracking-tighter px-1 break-words pb-0.5">{campaign.reward}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col bg-[#F5F7F6] min-h-screen relative font-sans pb-[100px]">
      
      {/* 1. Header (Logo styled header) */}
      <div className="bg-white w-full max-w-[480px] z-40 sticky top-0 border-b border-gray-100 flex items-center justify-center py-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
         <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-gray-500 active:bg-gray-50 rounded-full transition-colors">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
         </div>
         {/* Title mimicking "ALL member ภารกิจพิชิตรางวัล" */}
         <div className="flex items-center gap-1.5 h-8">
            <div className="bg-gradient-to-r from-[#8ac43f] to-[#4CAF50] text-white italic font-black text-[13px] px-2.5 py-1 rounded-[6px] rounded-tl-[12px] rounded-br-[12px] tracking-tight shadow-sm">Jula's Herb</div>
            <span className="text-[17px] font-black tracking-tight text-gray-800">ภารกิจพิชิตรางวัล</span>
            <div className="text-[14px] ml-1">🚩</div>
         </div>
         <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         </div>
      </div>

      {/* 2. Top Segmented Tabs Wrapper */}
      <div className="bg-white px-4 pt-3 pb-2 w-full max-w-[480px]">
         <div className="flex rounded-[10px] p-[3px] bg-[#F5F7F6] border border-gray-200/60 shadow-inner">
            <button 
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-1.5 text-[13.5px] font-bold rounded-[8px] transition-all duration-200 ${
                activeTab === 'active' 
                ? 'bg-[#4CAF50] text-white shadow-sm' 
                : 'bg-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
               กำลังทำภารกิจ
            </button>
            <button 
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-1.5 text-[13.5px] font-bold rounded-[8px] transition-all duration-200 ${
                activeTab === 'completed' 
                ? 'bg-[#4CAF50] text-white shadow-sm' 
                : 'bg-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
               ภารกิจที่จบแล้ว
            </button>
         </div>
      </div>

      {/* 3. Campaign Section */}
      <div className="bg-white px-4 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border-b border-gray-100 w-full max-w-[480px]">
        <h2 className="text-[16px] font-black text-gray-800 mb-3 flex items-center gap-2">
          <span>🎯</span> แคมเปญพิเศษ
        </h2>
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </div>

      {/* 4. Horizontal Multi-Filters (Dynamic Categories) */}
      <div className="bg-white px-4 pb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border-b border-gray-100 w-full max-w-[480px] sticky top-[56px] z-[39]">
         <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 pt-0.5">
            {filterCategories.map((cat) => (
               <button 
                 key={cat.id}
                 onClick={() => setActiveFilter(cat.id)}
                 className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold transition-all border ${
                   activeFilter === cat.id 
                   ? 'bg-green-50/80 text-[#4CAF50] border-green-200 shadow-sm scale-105' 
                   : 'bg-white text-gray-500 border-gray-200 active:bg-gray-50 hover:bg-gray-50'
                 }`}
               >
                  {cat.label}
               </button>
            ))}
         </div>
      </div>

      {/* 4. Missions List */}
      <div className="px-3.5 py-4 w-full flex flex-col gap-3 max-w-[480px]">
         
         {activeTab === 'active' ? (
           displayMissions.length > 0 ? (
             displayMissions.map((item) => {
               const percent = (item.progress / item.max) * 100;
               const nodesArr = Array.from({ length: item.nodes });
  
               return (
                 <div 
                   key={item.id} 
                   onClick={() => router.push(`/missions/${item.id}`)}
                   className="bg-white rounded-[16px] p-4 flex items-center justify-between border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all cursor-pointer group hover:border-[#4CAF50]/30"
                 >
                    
                    {/* Left Side (Labels & Progress) */}
                    <div className="flex-1 flex flex-col pt-1 pr-3">
                       <div className="flex items-center gap-2 mb-1">
                         <div className="bg-green-100 text-green-600 text-[9px] font-bold px-2 py-0.5 rounded-full">ภารกิจ</div>
                       </div>
                       <h3 className="font-bold text-[14.5px] text-gray-800 tracking-tight leading-snug">{item.title}</h3>
                       <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{item.desc}</p>
                       
                       <div className="mt-4 mb-2 w-full relative h-[6px] bg-gray-100 rounded-full flex items-center">
                          <div className="absolute top-0 left-0 h-full bg-[#4CAF50] rounded-full transition-all duration-700 shadow-sm" style={{ width: `${percent}%` }}></div>
                          
                          {/* Overlay Nodes */}
                          <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-[2px]">
                             {nodesArr.map((_, i) => {
                                const nodePercent = (i / (item.nodes - 1)) * 100;
                                const isActive = percent >= nodePercent;
                                return (
                                  <div key={i} className={`w-[12px] h-[12px] bg-white rounded-full flex items-center justify-center shadow-sm relative z-10 transition-colors ${isActive ? 'border-[3px] border-[#4CAF50]' : 'border-[3px] border-gray-200'}`}>
                                     {isActive && percent > 0 && i === Math.floor((percent/100)*(item.nodes-1)) && (
                                       <svg className="w-2.5 h-2.5 text-[#4CAF50] absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                     )}
                                  </div>
                                )
                             })}
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 mt-1.5">
                          <span className="font-bold text-gray-700">{item.progress}/{item.max}</span>
                          <span className="text-orange-600 font-bold">{item.timeLeft}</span>
                       </div>
                    </div>
  
                    {/* Right Side (Reward Badge) */}
                    <div className="w-[70px] h-[70px] flex items-center justify-center shrink-0">
                       <div className={`w-full h-full rounded-full border-[3px] ${item.badgeOutline} flex flex-col items-center justify-center relative overflow-hidden shadow-sm ${item.badgeBg}`}>
                          <div className="absolute inset-0 bg-white/40"></div>
                          <div className={`relative z-10 font-black text-center ${item.badgeColor}`}>
                             <div className="text-[13px] leading-none tracking-tighter drop-shadow-sm px-1 break-words pb-0.5">{item.badgeText}</div>
                          </div>
                          <div className="relative z-10 mt-0.5 bg-white/90 text-gray-800 text-[6.5px] font-black px-1.5 rounded-sm uppercase border border-gray-200/50 shadow-sm">{item.badgeSub}</div>
                       </div>
                    </div>
  
                 </div>
               )
             })
           ) : (
             <div className="py-20 flex flex-col items-center justify-center gap-3 opacity-60">
               <div className="text-[40px]">🔍</div>
               <p className="text-[13px] font-bold text-gray-400">ยังไม่มีภารกิจในหมวดหมู่นี้</p>
             </div>
           )
         ) : (
           <div className="py-20 flex flex-col items-center justify-center gap-3 opacity-60">
             <div className="text-[40px]">🏆</div>
             <p className="text-[13px] font-bold text-gray-400">ยังไม่มีภารกิจที่จบแล้ว</p>
           </div>
         )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
