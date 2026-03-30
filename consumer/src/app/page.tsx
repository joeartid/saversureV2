"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useTenant } from "@/components/TenantProvider";
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

/* ───────── Helpers ───────── */
const mediaUrl = (url?: string) => {
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
              <div className="jh-card-free-label">แลกรับฟรี !</div>
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
                      เพียง <span className="jh-pts">{reward.point_cost.toLocaleString()}</span> แต้ม{" "}
                      <span className="jh-pts-old">
                        (ปกติ <s>{reward.normal_point_cost.toLocaleString()}</s> แต้ม)
                      </span>
                    </div>
                  </>
                ) : (
                  <div>
                    <span className="jh-pts" style={{ fontSize: '24px' }}>{reward.point_cost.toLocaleString()}</span> แต้ม
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

/* ═══════════════════════════════════
   Home Page
   ═══════════════════════════════════ */
function JulaHerbHome() {
  const { brandName } = useTenant();
  const [activeTab, setActiveTab] = useState("julaherb");
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const loggedIn = isLoggedIn();

  const primaryBal = getPrimaryBalance(balances);
  const secondaryBals = getSecondaryBalances(balances);

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
    api.get<{ data: NewsItem[] }>("/api/v1/public/news?limit=5")
      .then((d) => setNewsList(d.data || [])).catch(() => {});
    if (loggedIn) {
      api.get<{ data: MultiBalance[] }>("/api/v1/my/balances")
        .then((d) => setBalances(d.data ?? [])).catch(() => {});
      api.get<UserProfile>("/api/v1/profile")
        .then((d) => setProfile(d)).catch(() => {});
    }
  }, [loggedIn]);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    brandName;

  const tabs = [
    { id: "julaherb", label: "สินค้าจุฬาเฮิร์บ" },
    { id: "premium", label: "สินค้าพรีเมียม" },
    { id: "lifestyle", label: "ไลฟ์สไตล์" },
    { id: "donate", label: "ร่วมบริจาค" },
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
        <div className="jh-banner-scroll">
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
                    <p className="jh-banner-caption">{news.title}</p>
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
              onClick={() => setActiveTab(tab.id)}
              className={`jh-tab ${activeTab === tab.id ? "active" : ""}`}>
              {tab.label}
            </span>
          ))}
        </div>

        {filteredRewards.length === 0 ? (
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
