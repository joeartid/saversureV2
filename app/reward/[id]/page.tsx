"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";

export default function RewardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Fetch real addresses from API
  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        setLoadingAddresses(true);
        const response = await fetch('/api/v1/profile/addresses');
        if (response.ok) {
          const data = await response.json();
          setAddresses(data.data || []);
          // Set default address if available
          const defaultAddr = data.data?.find((addr: any) => addr.is_default);
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
          } else if (data.data?.length > 0) {
            setSelectedAddressId(data.data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
      } finally {
        setLoadingAddresses(false);
      }
    };
    
    fetchAddresses();
  }, []);

  const currentAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getRewardData = (id: string) => {
    if (id === '1') {
      return {
        title: "เซรั่มมะรุม ลดรอยดำ 8ml (1 ซอง) Jula's Herb",
        points: 168,
        type: "physical",
        image: "https://shop.julasherb.in.th/wp-content/uploads/2021/04/0J5A1303-1-300x300.jpg",
        ref: "JHA-992-837A",
        desc: "ฟรีค่าส่ง! สินค้าแท้ส่งตรงจากบริษัท"
      };
    }
    if (id === '2') {
      return {
        title: "โค้ดส่วนลด 50 บาท (Shopee)",
        points: 500,
        type: "digital",
        image: "https://placehold.co/800x800/ffffee/ff8800?text=Shopee",
        ref: "SHP-50-DISCOUNT",
        desc: "โค้ดสามารถใช้เป็นส่วนลดได้ทันทีในแอปพลิเคชัน Shopee"
      };
    }
    return {
      title: "หมอนอิงแตงโม ลิมิเต็ด อิดิชั่น",
      points: 1200,
      type: "physical",
      image: "https://placehold.co/800x800/fce4ec/ec407a?text=🍉+Premium",
      ref: "PRM-101-WTM",
      desc: "สินค้าแรร์ไอเทม น่ารัก นุ่มนิ่ม (ขนาด 45cm)"
    }
  };

  const rewardData = getRewardData(resolvedParams.id);
  const userPoints = 2420;

  const handlePreRedeem = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmRedeem = async () => {
    try {
      const payload = {
        reward_id: resolvedParams.id,
        address_id: rewardData.type === 'physical' ? selectedAddressId : undefined
      };

      const response = await fetch('/api/v1/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowConfirmModal(false);
        setTimeout(() => {
           setShowSuccessModal(true);
        }, 300);
      } else {
        const errorData = await response.json();
        console.error('Redeem failed:', errorData);
        alert(errorData.message || 'เกิดข้อผิดพลาดในการแลกรางวัล');
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  return (
    <div className="w-full flex flex-col bg-[#F5F5F5] min-h-screen relative font-sans pb-[100px]">
      
      {/* 1. Floating Back Button (Local Nav) */}
      <div className="absolute top-3 left-3 z-30">
         <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
         </button>
      </div>

      {/* 2. Hero Image */}
      <div className="w-full aspect-square bg-gray-50 relative">
         <img src={rewardData.image} alt={rewardData.title} className="w-full h-full object-cover mix-blend-multiply opacity-90" />
         <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
         <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[10.5px] font-black px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm font-mono tracking-widest border border-white/20">REF: {rewardData.ref.substring(0,6)}</div>
      </div>

      {/* 3. Reward Info (Points & Title) */}
      <div className="bg-white px-4 pt-4 pb-5 mb-2 shadow-sm rounded-b-[16px]">
         <div className="flex items-start justify-between mb-2">
            <h1 className="text-[17px] font-bold text-gray-800 leading-snug pr-4">{rewardData.title}</h1>
            <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 border border-gray-100 text-gray-400">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
         </div>
         
         <div className="flex items-end gap-1.5 mb-4 border-b border-gray-100 pb-4">
            <div className="text-[28px] font-black text-[#4CAF50] leading-none tracking-tight drop-shadow-sm flex items-start gap-1.5">
               <svg className="w-[20px] h-[20px] mt-1.5 text-[#8ac43f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08-.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               {rewardData.points} <span className="text-[13px] mt-[10px] font-bold uppercase text-gray-500 tracking-wide">Points</span>
            </div>
         </div>

         <div className="flex items-center gap-4">
            {/* Progress Bar for Stock */}
            <div className="flex-1">
               <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1.5">
                 <span>คงเหลือ 48 สิทธิ์</span>
                 <span className="text-orange-500">จำกัด 1 สิทธิ์/คน</span>
               </div>
               <div className="w-full bg-orange-100 rounded-full h-[6px] overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-400 to-[#ee4d2d] h-full rounded-full w-[20%] relative"></div>
               </div>
            </div>
         </div>
      </div>

      {/* 4. T&C and Details */}
      <div className="bg-white p-4.5 shadow-sm mb-2 rounded-[16px] px-4 pt-4 pb-5">
         <h2 className="text-[14px] font-black text-gray-800 mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 uppercase tracking-tight">
            <svg className="w-[18px] h-[18px] text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            รายละเอียด และ เงื่อนไข
         </h2>
         <div className="text-[12px] text-gray-600 leading-relaxed font-medium space-y-2.5 pt-1">
            <p className="flex items-start gap-2 relative pl-3">
              <span className="text-[#4CAF50] text-[8px] absolute left-0 top-1.5">●</span> 
              {rewardData.desc}
            </p>
            <p className="flex items-start gap-2 relative pl-3">
              <span className="text-[#4CAF50] text-[8px] absolute left-0 top-1.5">●</span> 
              สิทธิพิเศษนี้สำหรับสมาชิก Jula's Herb ที่มีคะแนนสะสมเพียงพอตามที่กำหนดไว้เท่านั้น
            </p>
            <p className="flex items-start gap-2 relative pl-3">
              <span className="text-[#4CAF50] text-[8px] absolute left-0 top-1.5">●</span> 
              เมื่อกดยืนยันแลกรับสิทธิ์แล้ว ระบบจะตัดคะแนนสะสมทันที และ<span className="font-bold border-b border-red-300">ไม่สามารถยกเลิกคำขอหรือขอคืนคะแนนได้ทุกกรณี</span>
            </p>
            <p className="flex items-start gap-2 relative pl-3">
              <span className="text-[#ee4d2d] text-[8px] absolute left-0 top-1.5">●</span> 
              รูปภาพสินค้าใช้เพื่อการโฆษณาและการสื่อสารเท่านั้น สินค้าจริงอาจมีความแตกต่างตามล็อตการผลิต
            </p>
         </div>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-[16px] flex items-center gap-3">
         <div className="w-[42px] h-[42px] bg-green-50 rounded-full flex items-center justify-center text-[#4CAF50] shrink-0 border border-green-100 shadow-[inset_0_2px_4px_rgba(76,175,80,0.1)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         </div>
         <div className="flex-1">
            <div className="text-[12.5px] font-bold text-gray-800">มีข้อสงสัยเกี่ยวกับการแลกแต้ม?</div>
            <div className="text-[10px] text-gray-500 font-medium">ติดต่อฝ่ายบริการลูกค้า Jula's Herb</div>
         </div>
         <button className="text-[11px] font-bold text-[#2E7D32] border border-[#2E7D32] px-3.5 py-1.5 rounded-full active:bg-green-50 transition-colors">ติดต่อเรา</button>
      </div>

      {/* 5. Floating Pre-Redeem Bar (Moves above Bottom Nav) */}
      <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[448px] h-[72px] bg-white/95 backdrop-blur-md flex items-center justify-between px-4 z-[40] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white rounded-[20px]">
         <div className="flex flex-col">
            <span className="text-[10.5px] text-gray-500 font-bold tracking-wide">คะแนนปัจจุบัน: <span className="text-[#8ac43f] font-black">{userPoints.toLocaleString()} P</span></span>
            {userPoints >= rewardData.points ? (
               <span className="text-[13.5px] font-black text-gray-800 leading-tight">คะแนนพอสำหรับแลก!</span>
            ) : (
               <span className="text-[14px] font-black text-red-500 leading-tight">คะแนนไม่เพียงพอ</span>
            )}
         </div>
         <button 
            disabled={userPoints < rewardData.points}
            onClick={handlePreRedeem}
            className={`px-7 py-3 flex items-center justify-center font-black text-[14px] rounded-[14px] transition-all
              ${userPoints >= rewardData.points 
                ? 'bg-gradient-to-r from-[#8ac43f] to-[#6b9e2f] shadow-[0_4px_16px_rgba(138,196,63,0.4)] text-white hover:scale-105 active:scale-95' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
         >
            แลกคะแนนเลย
         </button>
      </div>

      {/* 6. Pre-Redeem Confirmation Pop-up */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[45] flex items-center justify-center p-4 pb-[80px] bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
           {/* Click to close backdrop */}
           <div className="absolute inset-0 cursor-pointer" onClick={() => setShowConfirmModal(false)}></div>
           
           <div className="bg-white w-full max-w-[380px] rounded-[24px] mx-auto p-5 pb-6 shadow-2xl relative z-10 animate-[dropIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] max-h-[85vh] overflow-y-auto">
              
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                 <h2 className="text-[18px] font-black text-gray-800 tracking-tight">ยืนยันการแลกรางวัล</h2>
                 <button onClick={() => setShowConfirmModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold active:bg-gray-200 transition-colors">✕</button>
              </div>

              <div className="flex gap-4 items-center bg-gray-50 p-3 rounded-[12px] border border-gray-100 mb-5">
                 <img src={rewardData.image} className="w-16 h-16 rounded-xl object-cover shadow-sm bg-white" alt=""/>
                 <div className="flex-1">
                    <div className="font-bold text-[13px] text-gray-800 leading-snug line-clamp-2">{rewardData.title}</div>
                    <div className="text-gray-500 font-medium text-[10px] mt-0.5">ใช้แต้มแลกรับ</div>
                    <div className="text-[#4CAF50] font-black text-[16px] leading-none mt-0.5">-{rewardData.points} P</div>
                 </div>
              </div>

              {/* Dynamic Summary Check */}
              {rewardData.type === 'physical' && (
                <div className="mb-6 animate-fade-in">
                   <div className="flex justify-between items-center mb-2">
                       <div className="text-[13px] font-bold text-gray-800">จัดส่งไปที่</div>
                       <button onClick={() => setShowAddressModal(true)} className="text-[11.5px] text-[#2E7D32] bg-green-50 px-2 py-0.5 rounded-md font-bold active:bg-green-100">เปลี่ยนที่อยู่</button>
                   </div>
                   {currentAddress ? (
                     <div className="bg-white border border-[#4CAF50] rounded-[12px] p-3.5 relative overflow-hidden shadow-[0_2px_8px_rgba(76,175,80,0.08)]">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4CAF50]"></div>
                        <div className="text-[12.5px] font-bold text-gray-800 mb-1 flex items-center gap-2">
                           {currentAddress.recipient_name} <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-medium">{currentAddress.phone}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium leading-relaxed max-w-[90%]">
                           {currentAddress.address_line1} {currentAddress.address_line2 && `${currentAddress.address_line2}, `} 
                           {currentAddress.sub_district && `${currentAddress.sub_district}, `} 
                           {currentAddress.district && `${currentAddress.district}, `} 
                           {currentAddress.province && `${currentAddress.province} `} 
                           {currentAddress.postal_code}
                        </div>
                     </div>
                   ) : (
                     <div className="bg-red-50 border border-red-200 rounded-[12px] p-3.5">
                        <div className="text-red-600 font-bold text-sm">ไม่พบที่อยู่จัดส่งที่เลือก</div>
                        <div className="text-red-500 text-xs mt-1">กรุณาเลือกที่อยู่จัดส่ง</div>
                     </div>
                   )}
                </div>
              )}

              {rewardData.type === 'digital' && (
                <div className="mb-6 animate-fade-in">
                   <div className="text-[13px] font-bold text-gray-800 mb-2">ช่องทางการรับสิทธิ์</div>
                   <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-3 text-[12px] text-blue-800 flex items-start gap-2.5">
                      <svg className="w-5 h-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="leading-snug font-medium">รางวัลนี้คือโค้ด e-Coupon ดิจิทัล ระบบจะแสดงรหัสโปรโมชั่นให้คุณกดคัดลอกทันทีหลังทำการแลกแต้มสำเร็จ</span>
                   </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-[12px] p-3 border border-gray-100 mb-6">
                 <div className="flex justify-between text-[11.5px] font-bold mb-1.5">
                    <span className="text-gray-500">แต้มที่มีปัจจุบัน</span>
                    <span className="text-gray-800">{userPoints.toLocaleString()} P</span>
                 </div>
                 <div className="flex justify-between text-[11.5px] font-bold border-b border-gray-200 pb-1.5 mb-1.5">
                    <span className="text-gray-500">ใช้คะแนนครั้งนี้</span>
                    <span className="text-red-500">-{rewardData.points.toLocaleString()} P</span>
                 </div>
                 <div className="flex justify-between text-[13.5px] font-black">
                    <span className="text-gray-800">คงเหลือหลังแลกรับ</span>
                    <span className="text-[#4CAF50]">{(userPoints - rewardData.points).toLocaleString()} P</span>
                 </div>
              </div>

              <button 
                 onClick={handleConfirmRedeem} 
                 className="w-full py-4 flex items-center justify-center gap-2 bg-[#4CAF50] hover:bg-[#43a047] text-white font-black rounded-full text-[15px] shadow-[0_4px_12px_rgba(76,175,80,0.3)] active:scale-[0.98] transition-all uppercase tracking-wide"
              >
                 ยืนยันแลกแต้ม
              </button>
           </div>
        </div>
      )}

      {/* Address Selection Pop-up */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[48] flex items-center justify-center p-4 pb-[80px] bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowAddressModal(false)}></div>
            <div className="bg-white w-full max-w-[380px] h-[600px] rounded-[24px] mx-auto shadow-2xl relative z-10 animate-[dropIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] flex flex-col">
               <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
                  <h2 className="text-[18px] font-black text-gray-800 tracking-tight">เลือกที่อยู่จัดส่ง</h2>
                  <button onClick={() => setShowAddressModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold active:bg-gray-200 transition-colors">✕</button>
               </div>
               
               <div className="flex-1 overflow-y-auto px-5 py-4">
                  {loadingAddresses ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-gray-500 text-sm">กำลังโหลดที่อยู่...</div>
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-gray-500 text-sm">ไม่พบที่อยู่จัดส่ง</div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {addresses.map((addr) => (
                        <div 
                           key={addr.id} 
                           onClick={() => setSelectedAddressId(addr.id)}
                           className={`p-3.5 border rounded-[12px] cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-[#4CAF50] bg-green-50 shadow-[0_2px_8px_rgba(76,175,80,0.15)] ring-1 ring-[#4CAF50]' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                        >
                           <div className="flex items-start justify-between">
                             <div className="flex flex-col gap-1 pr-4">
                                <div className="text-[13.5px] font-bold text-gray-800 flex items-center gap-2">
                                   {addr.recipient_name} 
                                   <span className="text-[10.5px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-medium">{addr.phone}</span>
                                   {addr.is_default && <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-sm">ค่าเริ่มต้น</span>}
                                </div>
                                <div className="text-[11.5px] text-gray-600 leading-snug">
                                   {addr.address_line1} {addr.address_line2 && `${addr.address_line2}, `} 
                                   {addr.sub_district && `${addr.sub_district}, `} 
                                   {addr.district && `${addr.district}, `} 
                                   {addr.province && `${addr.province} `} 
                                   {addr.postal_code}
                                </div>
                             </div>
                             <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${selectedAddressId === addr.id ? 'border-[#4CAF50] bg-[#4CAF50]' : 'border-gray-300'}`}>
                               {selectedAddressId === addr.id && <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
               
               <div className="p-5 pt-0 space-y-3 shrink-0">
                  <button className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-[12px] text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                     เพิ่มที่อยู่ใหม่
                  </button>
                  
                  <button 
                    onClick={() => setShowAddressModal(false)}
                    className="w-full py-4 flex items-center justify-center gap-2 bg-[#4CAF50] hover:bg-[#43a047] text-white font-black rounded-full text-[15px] shadow-[0_4px_12px_rgba(76,175,80,0.3)] active:scale-[0.98] transition-all tracking-wide"
                  >
                     ยืนยันที่อยู่จัดส่ง
                  </button>
               </div>
            </div>
        </div>
      )}

      {/* 7. Success E-Ticket Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[49] flex items-center justify-center p-5 pb-[80px] font-sans">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={() => setShowSuccessModal(false)}></div>
           <div className="bg-[#fcfcfc] rounded-[24px] w-full max-w-[340px] relative z-10 overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] animate-[dropIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
              
              {/* Header Green Pattern */}
              <div className="h-[120px] bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] relative overflow-hidden flex flex-col items-center justify-center pt-2">
                 <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiM0Y2FmNTAiLz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMzg4ZTNjIi8+PC9zdmc+')] opacity-60 mix-blend-overlay"></div>
                 <div className="w-[68px] h-[68px] bg-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.4)] relative z-10 scale-0 animate-[popScale_0.4s_0.25s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                    <svg className="w-10 h-10 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                 </div>
              </div>

              {/* Receipt cutoff jagged edges */}
              <div className="relative h-[8px] -mt-[4px] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSI4Ij4KICA8cGF0aCBkPSJNMCAwIEw2IDggTDEyIDAgWiIgZmlsbD0iI2ZjZmNmYyIvPgo8L3N2Zz4=')] bg-repeat-x z-20"></div>

              {/* Ticket Body */}
              <div className="p-6 pt-5 text-center">
                 <h2 className="text-[24px] font-black text-gray-800 tracking-tight leading-none mb-1.5 text-center">แลกเปลี่ยนสำเร็จ!</h2>
                 <p className="text-[12px] text-gray-500 font-medium mt-0 mb-5 leading-relaxed">คุณได้ใช้ {rewardData.points} แต้ม แลกรับ<br/>{rewardData.title} เรียบร้อยแล้ว</p>
                 
                 <div className="border-t border-b border-dashed border-gray-300 py-3.5 mb-4.5 flex flex-col items-center justify-center relative">
                    {/* Semi-circle cutouts strictly for E-Ticket style */}
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black/60 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)]"></div>
                    <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black/60 shadow-[inset_2px_0_4px_rgba(0,0,0,0.1)]"></div>
                    
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${rewardData.ref}`} alt="QR Code" className="w-[120px] h-[120px] rounded-[10px] p-1.5 border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.03)] bg-white" />
                 </div>

                 <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-[12px] p-3 border border-gray-200 font-mono text-[16px] font-black tracking-[0.2em] text-gray-800 mb-6 relative overflow-hidden shadow-inner flex justify-center items-center mt-4">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#4CAF50]"></div>
                    {rewardData.ref}
                 </div>

                 <button 
                  onClick={() => router.push('/history?tab=redeem')}
                  className="w-full bg-[#1b5e20] text-white py-3.5 rounded-full font-black text-[14.5px] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(27,94,32,0.3)] hover:bg-green-800 tracking-wide"
                 >
                    ดูคำสั่งแลกแต้มของฉัน
                 </button>
                 <button onClick={() => { setShowSuccessModal(false); router.back(); }} className="mt-3 text-[11px] font-bold text-gray-400 active:text-gray-600 underline">กลับไปหน้าเดิม</button>
              </div>

           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dropIn {
          0% { transform: translateY(-30px) scale(0.95); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes popScale {
          0% { transform: scale(0); }
          80% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
      `}} />
    </div>
  );
}
