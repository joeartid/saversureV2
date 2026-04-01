"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useTenant } from "@/components/TenantProvider";
import toast from "react-hot-toast";
import {
  type MultiBalance,
  getPrimaryBalance,
  getSecondaryBalances,
} from "@/lib/currency";

/* ───────── Types ───────── */
interface RewardItem {
  id: string;
  name: string;
  description: string;
  type: string;
  point_cost: number;
  normal_point_cost: number;
  price: number;
  cost_currency: string;
  image_url?: string;
  delivery_type: string;
  available_qty: number;
  is_flash: boolean;
  tier_name?: string;
  valid_from?: string;
}

interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  image_url?: string;
  banner_image?: string;
  type: string;
}

interface UserProfile {
  display_name?: string;
  first_name?: string;
  last_name?: string;
}

interface Donation {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_points: number;
  collected_points: number;
  status: string;
  donor_count: number;
}

interface LuckyDraw {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  point_cost: number;
  status: string;
  end_date: string | null;
}

/* ───────── Helpers ───────── */
const mediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

/* ═══════════════════════════════════
   ListItemCard — ตาม mockup จริงที่ run
   (ไม่ใช่ fallback จาก source code)
   ═══════════════════════════════════ */
function RewardCard({ reward, idx }: { reward: RewardItem; idx: number }) {
  const imgSrc = mediaUrl(reward.image_url);
  const price = reward.price || 0;

  // สีพื้นหลังรูป (สลับ pastel)
  const bgClasses = ["jh-bg-green", "jh-bg-pink", "jh-bg-blue", "jh-bg-yellow", "jh-bg-purple", "jh-bg-teal"];
  const bgClass = bgClasses[idx % bgClasses.length];

  return (
    <Link href={`/rewards/${reward.id}`}>
      <div className="jh-card">
        <div className="jh-card-inner">
          {/* ═══ รูป ═══ */}
          <div className={`jh-card-img ${bgClass}`}>
            {reward.is_flash && (
              <div className="jh-flash-badge">⚡ FLASH</div>
            )}
            {imgSrc ? (
              <Image
                src={imgSrc}
                alt={reward.name}
                width={180}
                height={180}
                className="jh-card-product-img"
              />
            ) : (
              <div className="jh-card-emoji">🎁</div>
            )}
          </div>

          {/* ═══ ข้อมูล ═══ */}
          <div className="jh-card-detail">
            <div className="jh-card-detail-top">
              <div className="jh-card-free-label w-fit">แลกรับฟรี !</div>
              <div className="jh-card-name">{reward.name}</div>
              <div className="jh-card-price">{price} <span>บาท</span></div>
            </div>

            <div className="jh-card-detail-bottom">
              <div
                className={`jh-card-discount ${
                  typeof reward.normal_point_cost === "number" && reward.normal_point_cost > reward.point_cost
                    ? "bg-[#eff5f0] rounded-lg px-2.5 py-1 mt-1 mb-1"
                    : "my-1"
                }`}
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              >
                {(typeof reward.normal_point_cost === "number" && reward.normal_point_cost > reward.point_cost) ? (
                  <>
                    <strong>พิเศษ! ลดแลกแต้มสินค้า</strong>
                    <div>
                      เพียง <span className="jh-pts">{(reward.point_cost || 0).toLocaleString()}</span> แต้ม{" "}
                      <span className="jh-pts-old">
                        (ปกติ <s>{(reward.normal_point_cost || 0).toLocaleString()}</s> แต้ม)
                      </span>
                    </div>
                  </>
                ) : (
                  <div>
                    <span className="jh-pts" style={{ fontSize: '24px' }}>{(reward.point_cost || 0).toLocaleString()}</span> แต้ม
                  </div>
                )}
              </div>

              {/* Point button */}
              <div className="jh-card-point-btn">
                แลกรับสิทธิ์
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function DonationCard({ donation, onDonate }: { donation: Donation; onDonate: (d: Donation) => void }) {
  const imgSrc = mediaUrl(donation.image_url);
  const progress = donation.target_points > 0 ? Math.min(100, (donation.collected_points / donation.target_points) * 100) : 0;
  
  return (
    <div className="jh-card cursor-pointer" onClick={() => onDonate(donation)}>
      <div className="jh-card-inner">
        <div className="jh-card-img jh-bg-teal">
          {imgSrc ? (
            <img src={imgSrc} alt="" className="jh-card-product-img" />
          ) : (
            <div className="jh-card-emoji">❤️</div>
          )}
        </div>
        
        <div className="jh-card-detail">
          <div className="jh-card-detail-top">
            <div className="jh-card-free-label w-fit">ร่วมบุญ</div>
            <div className="jh-card-name line-clamp-2" style={{ fontSize: '16px' }}>{donation.title}</div>
          </div>

          <div className="jh-card-detail-bottom mt-1">
            <div className="w-full text-[13px] text-[var(--on-surface-variant)] mb-1 flex justify-between">
              <span>สะสมแล้ว {(donation.collected_points || 0).toLocaleString()} / {(donation.target_points || 0).toLocaleString()} แต้ม</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--outline-variant)] rounded-[var(--radius-sm)] overflow-hidden mb-2">
              <div
                className="h-full bg-[var(--primary)] rounded-[var(--radius-sm)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="jh-card-point-btn">
              ร่วมบริจาค
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LuckyDrawCard({ lucky }: { lucky: LuckyDraw }) {
  const imgSrc = mediaUrl(lucky.image_url);
  
  return (
    <Link href={`/lucky-draws/${lucky.id}`}>
      <div className="jh-card">
        <div className="jh-card-inner">
          <div className="jh-card-img jh-bg-teal">
            {imgSrc ? (
              <img src={imgSrc} alt="" className="jh-card-product-img" />
            ) : (
              <div className="jh-card-emoji">🎁</div>
            )}
          </div>
          
          <div className="jh-card-detail">
            <div className="jh-card-detail-top">
              <div className="jh-card-free-label !bg-amber-100 !text-amber-600 w-fit">ลุ้นโชค</div>
              <div className="jh-card-name line-clamp-2" style={{ fontSize: '16px' }}>{lucky.title}</div>
            </div>

            <div className="jh-card-detail-bottom mt-2">
              <div className="w-full text-[13px] text-[var(--on-surface-variant)] mb-2 flex items-center justify-between">
                <div>
                  ใช้ <span className="text-[var(--primary)] font-bold text-[14px]">{(lucky.point_cost || 0).toLocaleString()}</span> แต้ม/สิทธิ์
                </div>
              </div>
              
              <div className="jh-card-point-btn !bg-orange-500 hover:!bg-orange-600 shadow-sm border-0 text-white">
                ร่วมสนุก
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════
   Home Page
   ═══════════════════════════════════ */
function JulaHerbHome() {
  const { brandName } = useTenant();
  const [activeTab, setActiveTab] = useState("julaherb");
  const [rewards, setRewards] = useState<RewardItem[]>([]);

  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [donateAmount, setDonateAmount] = useState<number>(10);
  const [donating, setDonating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };
  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };
  const [donations, setDonations] = useState<Donation[]>([]);
  const [luckyDraws, setLuckyDraws] = useState<LuckyDraw[]>([]);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const loggedIn = isLoggedIn();

  const primaryBal = getPrimaryBalance(balances);
  const secondaryBals = getSecondaryBalances(balances);

  const fetchBalances = () => {
    if (loggedIn) {
      api.get<{ data: MultiBalance[] }>("/api/v1/my/balances")
        .then((d) => setBalances(d.data ?? [])).catch(() => {});
    }
  };

  const fetchDonations = () => {
    api.get<{ data: Donation[] }>("/api/v1/public/donations")
      .then((d) => setDonations(d.data || [])).catch(() => {});
  };

  useEffect(() => {
    api.get<{ data: RewardItem[] }>("/api/v1/public/rewards?limit=20")
      .then((d) => {
        const items = d.data || [];
        items.unshift({
          id: "mock-0-point-test",
          name: "[TEST] ไอเทมเทสระบบ 0 แต้ม",
          description: "ทดสอบหน้าต่างกดแลกแจกฟรี ไม่มีหักแต้ม",
          type: "product",
          point_cost: 0,
          normal_point_cost: 499,
          price: 999,
          cost_currency: "point",
          image_url: "",
          delivery_type: "shipping",
          available_qty: 999,
          is_flash: true,
          tier_name: "Member"
        });
        setRewards(items);
      }).catch(() => {});
    
    fetchDonations();
    
    api.get<{ data: LuckyDraw[] }>("/api/v1/public/lucky-draw")
      .then((d) => setLuckyDraws(d.data || [])).catch(() => {});
    api.get<{ data: NewsItem[] }>("/api/v1/public/news?limit=5")
      .then((d) => setNewsList(d.data || [])).catch(() => {});
    if (loggedIn) {
      fetchBalances();
      api.get<UserProfile>("/api/v1/profile")
        .then((d) => setProfile(d)).catch(() => {});
    }
  }, [loggedIn]);

  const handleDonate = async () => {
    if (!selectedDonation) return;
    if (!loggedIn) {
      toast.error("กรุณาเข้าสู่ระบบก่อนร่วมบริจาค");
      return;
    }

    setDonating(true);
    try {
      await api.post(`/api/v1/my/donations/${selectedDonation.id}/donate`, {
        points: donateAmount
      });
      toast.success("ขอบคุณที่ร่วมบริจาคแต้ม!");
      setSelectedDonation(null);
      fetchBalances();
      fetchDonations();
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการบริจาค");
    } finally {
      setDonating(false);
    }
  };

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    brandName;

  const tabs = [
    { id: "julaherb", label: "สินค้าจุฬาเฮิร์บ" },
    { id: "premium", label: "สินค้าพรีเมียม" },
    { id: "lifestyle", label: "ไลฟ์สไตล์" },
    { id: "donate", label: "ร่วมบริจาค" },
    { id: "lucky", label: "ลุ้นโชค" },
  ];

  const filteredRewards =
    activeTab === "julaherb"
      ? rewards.filter((r) => String(r.type).toLowerCase() === "product")
      : activeTab === "premium"
      ? rewards.filter((r) => String(r.type).toLowerCase() === "premium")
      : activeTab === "lifestyle"
      ? rewards.filter((r) => ["coupon", "digital", "ticket"].includes(String(r.type).toLowerCase()) || ["coupon", "digital", "ticket"].includes(String(r.delivery_type).toLowerCase()))
      : activeTab === "donate"
      ? rewards.filter((r) => String(r.delivery_type).toLowerCase() === "none" || String(r.type).toLowerCase() === "donation")
      : rewards;

  const banners = newsList.length > 0 ? newsList : null;
  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((p) => (p + 1) % banners.length), 3000);
    return () => clearInterval(t);
  }, [banners]);

  return (
    <>


      {/* ══════ Banner ══════ */}
      <div className="jh-banner-section">
        <div 
          className="jh-banner-scroll cursor-grab active:cursor-grabbing"
          ref={scrollRef}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
          style={{ scrollSnapType: isDragging ? "none" : "x mandatory" }}
        >
          {banners
            ? banners.map((news) => {
                const img = mediaUrl(news.banner_image || news.image_url);
                return (
                  <Link key={news.id} href={`/news/${news.id}`} className="jh-banner-slide">
                    {img ? (
                      <Image src={img} alt={news.title} width={240} height={112}
                        className="jh-banner-img" />
                    ) : (
                      <div className="jh-banner-placeholder">{news.title}</div>
                    )}
                  </Link>
                );
              })
            : [
                { title: "คำถามที่พบบ่อย เกี่ยวกับการสแกนสินค้าจุฬาเฮิร์บ" },
                { title: "สะสมแต้มแลกรางวัล สแกน QR Code รับแต้มทันที!" },
              ].map((b, i) => (
                <div key={i} className="jh-banner-slide">
                  <div className="jh-banner-placeholder">{b.title}</div>
                </div>
              ))}
          <div style={{ width: 16, flexShrink: 0 }}>&nbsp;</div>
        </div>
        <div className="jh-banner-dots">
          {(banners || [null, null]).map((_, i) => (
            <div key={i} className={`jh-dot ${i === bannerIdx ? "active" : ""}`} />
          ))}
        </div>
      </div>

      <div className="jh-rewards-section">
        <h2 className="jh-section-title">แลกสิทธิพิเศษสำหรับคุณ</h2>

        <div className="jh-tabs">
          {tabs.map((tab) => (
            <span key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`jh-tab ${activeTab === tab.id ? "active" : ""}`}>
              {tab.label}
            </span>
          ))}
        </div>

        {activeTab === "donate" ? (
          donations.length === 0 ? (
            <div className="jh-empty">
              <div className="jh-empty-icon">❤️</div>
              <p>ยังไม่มีโครงการบริจาคในขณะนี้</p>
            </div>
          ) : (
            <>
              {donations.map((d) => (
                <DonationCard key={d.id} donation={d} onDonate={setSelectedDonation} />
              ))}
            </>
          )
        ) : activeTab === "lucky" ? (
          luckyDraws.length === 0 ? (
            <div className="jh-empty">
              <div className="jh-empty-icon">🎁</div>
              <p>ยังไม่มีกิจกรรมลุ้นโชคในขณะนี้</p>
            </div>
          ) : (
            <>
              {luckyDraws.map((l) => (
                <LuckyDrawCard key={l.id} lucky={l} />
              ))}
            </>
          )
        ) : filteredRewards.length === 0 ? (
          <div className="jh-empty">
            <div className="jh-empty-icon">🎁</div>
            <p>ยังไม่มีของรางวัลในหมวดนี้</p>
          </div>
        ) : (
          filteredRewards.map((reward, idx) => (
            <RewardCard key={reward.id} reward={reward} idx={idx} />
          ))
        )}
      </div>

      {/* ══════ Donation Modal ══════ */}
      {selectedDonation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[24px] w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="relative h-40 bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)]">
              {selectedDonation.image_url ? (
                <img 
                  src={mediaUrl(selectedDonation.image_url) || ""} 
                  className="w-full h-full object-cover opacity-40" 
                  alt="" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">❤️</div>
              )}
              <button 
                onClick={() => setSelectedDonation(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40 transition-colors"
              >
                ✕
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <h3 className="text-white font-bold text-xl line-clamp-1">{selectedDonation.title}</h3>
                <p className="text-white/80 text-xs mt-1">ร่วมเป็นส่วนหนึ่งในการช่วยเหลือสังคม</p>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="text-sm font-bold text-gray-500 mb-3 block">เลือกจำนวนแต้มที่ต้องการบริจาค</label>
                <div className="grid grid-cols-3 gap-3">
                  {[10, 50, 100, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setDonateAmount(amt)}
                      className={`py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                        donateAmount === amt 
                          ? "border-[var(--jh-green)] bg-green-50 text-[var(--jh-green)]" 
                          : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"
                      }`}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="ระบุเอง"
                      className="w-full py-2.5 px-3 rounded-xl font-bold text-sm border-2 border-gray-100 bg-gray-50 outline-none focus:border-[var(--jh-green)] text-center"
                      onChange={(e) => setDonateAmount(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 mb-6 flex items-start gap-3">
                <div className="text-amber-500 mt-0.5">💡</div>
                <p className="text-[12px] text-amber-700 leading-relaxed">
                  แต้มของคุณจะถูกหักทันทีหลังจากกดยืนยัน และคุณสามารถตรวจสอบประวัติได้ที่หน้า "ประวัติการบริจาค"
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedDonation(null)}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-gray-400 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDonate}
                  disabled={donating || donateAmount <= 0}
                  className="flex-[2] py-3.5 rounded-2xl font-bold text-white bg-[linear-gradient(135deg,var(--jh-green)_0%,var(--jh-teal)_100%)] shadow-lg shadow-green-200 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  {donating ? "กำลังประมวลผล..." : "ยืนยันบริจาค"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-24 relative z-0">
        <JulaHerbHome />
      </div>
      <BottomNav />
    </div>
  );
}
