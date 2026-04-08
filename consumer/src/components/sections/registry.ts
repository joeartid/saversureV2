import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const HeroBanner = dynamic(() => import("./HeroBanner"));
const BannerCarousel = dynamic(() => import("./BannerCarousel"));
const FeatureMenu = dynamic(() => import("./FeatureMenu"));
const PointsSummary = dynamic(() => import("./PointsSummary"));
const PromoBanner = dynamic(() => import("./PromoBanner"));
const RichText = dynamic(() => import("./RichText"));
const RecentNews = dynamic(() => import("./RecentNews"));
const Spacer = dynamic(() => import("./Spacer"));
const FeatureList = dynamic(() => import("./FeatureList"));
const ProfileHeaderCard = dynamic(() => import("./ProfileHeaderCard"));
const ProfileTierProgress = dynamic(() => import("./ProfileTierProgress"));
const ProfilePointsCard = dynamic(() => import("./ProfilePointsCard"));
const ProfileWarningAlert = dynamic(() => import("./ProfileWarningAlert"));
const ProfileMenuGroup = dynamic(() => import("./ProfileMenuGroup"));
const ProfileLogoutButton = dynamic(() => import("./ProfileLogoutButton"));
const HistoryPageHeader = dynamic(() => import("./HistoryPageHeader"));
const HistoryStatSummary = dynamic(() => import("./HistoryStatSummary"));
const HistoryTabsNav = dynamic(() => import("./HistoryTabsNav"));
const HistoryScanList = dynamic(() => import("./HistoryScanList"));
const HomeNewsBannerCarousel = dynamic(() => import("./HomeNewsBannerCarousel"));
const HomeSectionHeading = dynamic(() => import("./HomeSectionHeading"));
const HomeRewardsTabs = dynamic(() => import("./HomeRewardsTabs"));
const HomeLuckyDrawList = dynamic(() => import("./HomeLuckyDrawList"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sectionRegistry: Record<string, ComponentType<any>> = {
  hero_banner: HeroBanner,
  banner_carousel: BannerCarousel,
  feature_menu: FeatureMenu,
  points_summary: PointsSummary,
  promo_banner: PromoBanner,
  rich_text: RichText,
  recent_news: RecentNews,
  spacer: Spacer,
  feature_list: FeatureList,
  profile_header_card: ProfileHeaderCard,
  profile_tier_progress: ProfileTierProgress,
  profile_points_card: ProfilePointsCard,
  profile_warning_alert: ProfileWarningAlert,
  profile_menu_group: ProfileMenuGroup,
  profile_logout_button: ProfileLogoutButton,
  history_page_header: HistoryPageHeader,
  history_stat_summary: HistoryStatSummary,
  history_tabs_nav: HistoryTabsNav,
  history_scan_list: HistoryScanList,
  home_news_banner_carousel: HomeNewsBannerCarousel,
  home_section_heading: HomeSectionHeading,
  home_rewards_tabs: HomeRewardsTabs,
  home_lucky_draw_list: HomeLuckyDrawList,
};

export interface SectionDefinition {
  id: string;
  type: string;
  order: number;
  visible: boolean;
  props: Record<string, unknown>;
}

export const sectionMeta: Record<
  string,
  { label: string; icon: string; description: string }
> = {
  hero_banner: {
    label: "Hero Banner",
    icon: "🖼️",
    description: "แบนเนอร์ใหญ่หัวหน้า พร้อมรูปภาพหรือ gradient",
  },
  banner_carousel: {
    label: "Banner Carousel",
    icon: "🎠",
    description: "Slideshow แบนเนอร์หลายรูป เลื่อนอัตโนมัติ",
  },
  feature_menu: {
    label: "Feature Menu",
    icon: "🔲",
    description: "Grid ไอคอนเมนูลัด เช่น สแกน, แลกรางวัล",
  },
  points_summary: {
    label: "Points Summary",
    icon: "🪙",
    description: "แสดงคะแนนสะสมและข้อมูลผู้ใช้",
  },
  promo_banner: {
    label: "Promo Banner",
    icon: "🎉",
    description: "แถบโปรโมชั่นพร้อมปุ่ม CTA",
  },
  rich_text: {
    label: "Rich Text",
    icon: "📝",
    description: "เนื้อหา HTML/ข้อความอิสระ",
  },
  recent_news: {
    label: "Recent News",
    icon: "📰",
    description: "ข่าวสารล่าสุดจากระบบ",
  },
  spacer: {
    label: "Spacer",
    icon: "↕️",
    description: "ช่องว่างระหว่าง section",
  },
  feature_list: {
    label: "Feature List",
    icon: "📋",
    description: "รายการ feature พร้อมไอคอนและคำอธิบาย",
  },
  profile_header_card: {
    label: "Profile Header Card",
    icon: "👤",
    description: "การ์ดแสดงโปรไฟล์ + tier badge + verified badge",
  },
  profile_tier_progress: {
    label: "Tier Progress",
    icon: "🏆",
    description: "แถบความคืบหน้า tier ระดับสมาชิก",
  },
  profile_points_card: {
    label: "Points Card",
    icon: "💰",
    description: "การ์ดแสดงแต้มสะสม + ปุ่มใช้แต้ม + สรุปประวัติ",
  },
  profile_warning_alert: {
    label: "Warning Alert",
    icon: "⚠️",
    description: "แจ้งเตือน (เช่น กรอกข้อมูลไม่ครบ) แสดงตามเงื่อนไข",
  },
  profile_menu_group: {
    label: "Menu Group",
    icon: "📋",
    description: "กลุ่มเมนูลิงก์ พร้อมไอคอน (เพิ่มได้หลายกลุ่ม)",
  },
  profile_logout_button: {
    label: "Logout Button",
    icon: "🚪",
    description: "ปุ่มออกจากระบบ (สีแดง)",
  },
  history_page_header: {
    label: "History Page Header",
    icon: "📜",
    description: "Header gradient ของหน้า /history + นับจำนวนสแกน",
  },
  history_stat_summary: {
    label: "History Stat Summary",
    icon: "📊",
    description: "การ์ดสรุป 4-column (สแกนสำเร็จ / แต้มสะสม / ยอดคงเหลือ / ทั้งหมด)",
  },
  history_tabs_nav: {
    label: "History Tabs Nav",
    icon: "🗂️",
    description: "แถบแท็บนำทาง (สะสม/แลก/คูปอง/ลุ้นโชค)",
  },
  history_scan_list: {
    label: "History Scan List",
    icon: "📋",
    description: "รายการสแกน พร้อม infinite scroll + group by date",
  },
  home_news_banner_carousel: {
    label: "Home — News Banner",
    icon: "🎠",
    description: "Banner carousel ดึงข่าวล่าสุดจาก API",
  },
  home_section_heading: {
    label: "Home — หัวข้อ Section",
    icon: "📝",
    description: "หัวข้อ section (title + subtitle)",
  },
  home_rewards_tabs: {
    label: "Home — Rewards พร้อม Tabs",
    icon: "🎁",
    description: "แสดงรางวัลพร้อมแท็บหลายหมวด + ลุ้นโชค",
  },
  home_lucky_draw_list: {
    label: "Home — ลุ้นโชค",
    icon: "🏆",
    description: "รายการกิจกรรมลุ้นโชค ดึงจาก API",
  },
};
