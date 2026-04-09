"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

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

interface LuckyDraw {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points: number;
  status: string;
  end_date: string | null;
}

type TabSource =
  | "rewards-product"
  | "rewards-premium"
  | "rewards-lifestyle"
  | "lucky-draw";

interface TabConfig {
  key: string;
  label: string;
  source: TabSource;
}

interface Props {
  limit?: number;
  default_tab?: string;
  show_flash_badge?: boolean;
  tabs?: TabConfig[];
}

const DEFAULT_TABS: TabConfig[] = [
  { key: "julaherb", label: "สินค้าจุฬาเฮิร์บ", source: "rewards-product" },
  { key: "premium", label: "สินค้าพรีเมียม", source: "rewards-premium" },
  { key: "lifestyle", label: "ไลฟ์สไตล์", source: "rewards-lifestyle" },
  { key: "lucky", label: "ลุ้นโชค", source: "lucky-draw" },
];

/* ───────── Cards ───────── */
function RewardCard({
  reward,
  idx,
  show_flash_badge,
}: {
  reward: RewardItem;
  idx: number;
  show_flash_badge: boolean;
}) {
  const imgSrc = mediaUrl(reward.image_url);
  const price = reward.price || 0;
  const bgClasses = [
    "jh-bg-green",
    "jh-bg-pink",
    "jh-bg-blue",
    "jh-bg-yellow",
    "jh-bg-purple",
    "jh-bg-teal",
  ];
  const bgClass = bgClasses[idx % bgClasses.length];

  return (
    <Link href={`/rewards/${reward.id}`}>
      <div className="jh-card">
        <div className="jh-card-inner">
          <div className={`jh-card-img ${bgClass}`}>
            {show_flash_badge && reward.is_flash && (
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

          <div className="jh-card-detail">
            <div className="jh-card-detail-top">
              <div className="jh-card-free-label w-fit">แลกรับฟรี !</div>
              <div className="jh-card-name">{reward.name}</div>
              <div className="jh-card-price">
                {price} <span>บาท</span>
              </div>
            </div>

            <div className="jh-card-detail-bottom">
              <div
                className={`jh-card-discount ${
                  typeof reward.normal_point_cost === "number" &&
                  reward.normal_point_cost > reward.point_cost
                    ? "bg-[#eff5f0] rounded-lg px-2.5 py-1 mt-1 mb-1"
                    : "my-1"
                }`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {typeof reward.normal_point_cost === "number" &&
                reward.normal_point_cost > reward.point_cost ? (
                  <>
                    <strong>พิเศษ! ลดแลกแต้มสินค้า</strong>
                    <div>
                      เพียง{" "}
                      <span className="jh-pts">
                        {(reward.point_cost || 0).toLocaleString()}
                      </span>{" "}
                      แต้ม{" "}
                      <span className="jh-pts-old">
                        (ปกติ{" "}
                        <s>{(reward.normal_point_cost || 0).toLocaleString()}</s>{" "}
                        แต้ม)
                      </span>
                    </div>
                  </>
                ) : (
                  <div>
                    <span className="jh-pts" style={{ fontSize: "24px" }}>
                      {(reward.point_cost || 0).toLocaleString()}
                    </span>{" "}
                    แต้ม
                  </div>
                )}
              </div>

              <div className="jh-card-point-btn">แลกรับสิทธิ์</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
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
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc} alt="" className="jh-card-product-img" />
            ) : (
              <div className="jh-card-emoji">🎁</div>
            )}
          </div>

          <div className="jh-card-detail">
            <div className="jh-card-detail-top">
              <div className="jh-card-free-label !bg-amber-100 !text-amber-600 w-fit">
                ลุ้นโชค
              </div>
              <div
                className="jh-card-name line-clamp-2"
                style={{ fontSize: "16px" }}
              >
                {lucky.title}
              </div>
            </div>

            <div className="jh-card-detail-bottom mt-2">
              <div className="w-full text-[13px] text-[var(--on-surface-variant)] mb-2 flex items-center justify-between">
                <div>
                  ใช้{" "}
                  <span className="text-[var(--primary)] font-bold text-[14px]">
                    {(lucky.cost_points || 0).toLocaleString()}
                  </span>{" "}
                  แต้ม/สิทธิ์
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

/* ───────── Main ───────── */
export default function HomeRewardsTabs({
  limit = 20,
  default_tab,
  show_flash_badge = true,
  tabs,
}: Props) {
  const resolvedTabs = useMemo<TabConfig[]>(() => {
    if (Array.isArray(tabs) && tabs.length > 0) {
      return tabs
        .filter((t) => t && t.key && t.label && t.source)
        .map((t) => ({
          key: String(t.key),
          label: String(t.label),
          source: t.source as TabSource,
        }));
    }
    return DEFAULT_TABS;
  }, [tabs]);

  const [activeTab, setActiveTab] = useState<string>(
    default_tab && resolvedTabs.some((t) => t.key === default_tab)
      ? default_tab
      : resolvedTabs[0]?.key || "julaherb",
  );
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [luckyDraws, setLuckyDraws] = useState<LuckyDraw[]>([]);

  useEffect(() => {
    api
      .get<{ data: RewardItem[] }>(`/api/v1/public/rewards?limit=${limit}`)
      .then((d) => setRewards(d.data || []))
      .catch(() => {});
    api
      .get<{ data: LuckyDraw[] }>("/api/v1/public/lucky-draw")
      .then((d) => setLuckyDraws(d.data || []))
      .catch(() => {});
  }, [limit]);

  const currentTab = resolvedTabs.find((t) => t.key === activeTab);

  const filteredRewards = (() => {
    if (!currentTab) return [];
    switch (currentTab.source) {
      case "rewards-product":
        return rewards.filter(
          (r) => String(r.type).toLowerCase() === "product",
        );
      case "rewards-premium":
        return rewards.filter(
          (r) => String(r.type).toLowerCase() === "premium",
        );
      case "rewards-lifestyle":
        return rewards.filter(
          (r) =>
            ["coupon", "digital", "ticket"].includes(
              String(r.type).toLowerCase(),
            ) ||
            ["coupon", "digital", "ticket"].includes(
              String(r.delivery_type).toLowerCase(),
            ),
        );
      default:
        return [];
    }
  })();

  const isLuckyTab = currentTab?.source === "lucky-draw";

  return (
    <div className="jh-rewards-section">
      <div className="jh-tabs">
        {resolvedTabs.map((tab) => (
          <span
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`jh-tab ${activeTab === tab.key ? "active" : ""}`}
          >
            {tab.label}
          </span>
        ))}
      </div>

      {isLuckyTab ? (
        luckyDraws.length === 0 ? (
          <div className="jh-empty">
            <div className="jh-empty-icon">🎁</div>
            <p>ยังไม่มีกิจกรรมลุ้นโชคในขณะนี้</p>
          </div>
        ) : (
          luckyDraws.map((l) => <LuckyDrawCard key={l.id} lucky={l} />)
        )
      ) : filteredRewards.length === 0 ? (
        <div className="jh-empty">
          <div className="jh-empty-icon">🎁</div>
          <p>ยังไม่มีของรางวัลในหมวดนี้</p>
        </div>
      ) : (
        filteredRewards.map((reward, idx) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            idx={idx}
            show_flash_badge={show_flash_badge}
          />
        ))
      )}
    </div>
  );
}
