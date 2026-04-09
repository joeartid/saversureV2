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
const HistoryStatSummary = dynamic(() => import("./HistoryStatSummary"));
const HistoryTabsNav = dynamic(() => import("./HistoryTabsNav"));
const HistoryScanList = dynamic(() => import("./HistoryScanList"));
const HistoryRedeemsList = dynamic(() => import("./HistoryRedeemsList"));
const HistoryCouponsList = dynamic(() => import("./HistoryCouponsList"));
const HistoryLuckyDrawList = dynamic(() => import("./HistoryLuckyDrawList"));
const HomeNewsBannerCarousel = dynamic(() => import("./HomeNewsBannerCarousel"));
const HomeSectionHeading = dynamic(() => import("./HomeSectionHeading"));
const HomeRewardsTabs = dynamic(() => import("./HomeRewardsTabs"));
const HomeLuckyDrawList = dynamic(() => import("./HomeLuckyDrawList"));
const RewardsTabsGrid = dynamic(() => import("./RewardsTabsGrid"));
const RewardsHistoryCta = dynamic(() => import("./RewardsHistoryCta"));
const MissionsTabsList = dynamic(() => import("./MissionsTabsList"));
const ShopLinksList = dynamic(() => import("./ShopLinksList"));
const WalletBalanceCards = dynamic(() => import("./WalletBalanceCards"));
const WalletTransactionList = dynamic(() => import("./WalletTransactionList"));
const NewsList = dynamic(() => import("./NewsList"));
const NotificationsList = dynamic(() => import("./NotificationsList"));
const SupportFaqList = dynamic(() => import("./SupportFaqList"));
const SupportContactCta = dynamic(() => import("./SupportContactCta"));
const SettingsNotificationsGroup = dynamic(() => import("./SettingsNotificationsGroup"));
const SettingsDeleteAccountCard = dynamic(() => import("./SettingsDeleteAccountCard"));
const SettingsAppVersionFooter = dynamic(() => import("./SettingsAppVersionFooter"));

// Generic SectionHeader (replaces 10 per-page header sections)
const SectionHeader = dynamic(() => import("./SectionHeader"));

// Backward-compat aliases for legacy header types (preset variant props)
const RewardsHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.RewardsHeaderAlias),
);
const MissionsHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.MissionsHeaderAlias),
);
const ShopHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.ShopHeaderAlias),
);
const WalletHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.WalletHeaderAlias),
);
const NewsHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.NewsHeaderAlias),
);
const NotificationsHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.NotificationsHeaderAlias),
);
const SupportHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.SupportHeaderAlias),
);
const SettingsHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.SettingsHeaderAlias),
);
const HistoryHeaderAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.HistoryHeaderAlias),
);
const PageHeaderBasicAlias = dynamic(() =>
  import("./SectionHeaderAliases").then((m) => m.PageHeaderBasicAlias),
);

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
  history_stat_summary: HistoryStatSummary,
  history_tabs_nav: HistoryTabsNav,
  history_scan_list: HistoryScanList,
  history_redeems_list: HistoryRedeemsList,
  history_coupons_list: HistoryCouponsList,
  history_lucky_draw_list: HistoryLuckyDrawList,
  home_news_banner_carousel: HomeNewsBannerCarousel,
  home_section_heading: HomeSectionHeading,
  home_rewards_tabs: HomeRewardsTabs,
  home_lucky_draw_list: HomeLuckyDrawList,
  rewards_tabs_grid: RewardsTabsGrid,
  rewards_history_cta: RewardsHistoryCta,
  missions_tabs_list: MissionsTabsList,
  shop_links_list: ShopLinksList,
  wallet_balance_cards: WalletBalanceCards,
  wallet_transaction_list: WalletTransactionList,
  news_list: NewsList,
  notifications_list: NotificationsList,
  support_faq_list: SupportFaqList,
  support_contact_cta: SupportContactCta,
  settings_notifications_group: SettingsNotificationsGroup,
  settings_delete_account_card: SettingsDeleteAccountCard,
  settings_app_version_footer: SettingsAppVersionFooter,

  // Unified header (new canonical type)
  section_header: SectionHeader,

  // Legacy header aliases (preserve existing DB rows)
  rewards_page_header: RewardsHeaderAlias,
  missions_page_header: MissionsHeaderAlias,
  shop_page_header: ShopHeaderAlias,
  wallet_page_header: WalletHeaderAlias,
  news_page_header: NewsHeaderAlias,
  notifications_page_header: NotificationsHeaderAlias,
  support_page_header: SupportHeaderAlias,
  settings_page_header: SettingsHeaderAlias,
  history_page_header: HistoryHeaderAlias,
  page_header_basic: PageHeaderBasicAlias,
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
  section_header: {
    label: "Header",
    icon: "📑",
    description: "Header ส่วนหัวของหน้า (รองรับทุกรูปแบบ — gradient / sticky / มี back button / ไอคอน / balance chips)",
  },
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
  history_stat_summary: {
    label: "Stat Summary (4 คอลัมน์)",
    icon: "📊",
    description: "การ์ดสรุป 4-column (สแกนสำเร็จ / แต้มสะสม / ยอดคงเหลือ / ทั้งหมด)",
  },
  history_tabs_nav: {
    label: "History Tabs Nav",
    icon: "🗂️",
    description: "แถบแท็บนำทาง (สะสม/แลก/คูปอง/ลุ้นโชค)",
  },
  history_scan_list: {
    label: "Scans",
    icon: "📋",
    description: "รายการสแกน group by date + infinite scroll (ออกแบบสำหรับ History)",
  },
  history_redeems_list: {
    label: "History — Redeems (สินค้า/จัดส่ง)",
    icon: "📦",
    description: "รายการแลกของรางวัลประเภทจัดส่ง/รับหน้าร้าน — ดึง API /api/v1/my/redeem-transactions",
  },
  history_coupons_list: {
    label: "History — Coupons (คูปอง/ดิจิทัล/ตั๋ว)",
    icon: "🎫",
    description: "รายการคูปอง/สิทธิ์ดิจิทัล พร้อมปุ่มใช้คูปอง (QR/Barcode) — ดึง API /api/v1/my/redeem-transactions",
  },
  history_lucky_draw_list: {
    label: "History — Lucky Draw (ตั๋วลุ้นโชค)",
    icon: "🎟️",
    description: "รายการสิทธิ์ลุ้นโชคของผู้ใช้ — ดึง API /api/v1/my/lucky-draw/tickets",
  },
  home_news_banner_carousel: {
    label: "News Banner Carousel",
    icon: "🎠",
    description: "Banner carousel ดึงข่าวล่าสุดจาก API (ออกแบบสำหรับหน้า Home)",
  },
  home_section_heading: {
    label: "Section Heading",
    icon: "📝",
    description: "หัวข้อ section คั่นกลาง (title + subtitle) ไม่มี gradient",
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
  rewards_tabs_grid: {
    label: "Rewards — Tabs + Grid",
    icon: "🎁",
    description: "แท็บกรองหมวด + grid ของรางวัล",
  },
  rewards_history_cta: {
    label: "Rewards — History CTA",
    icon: "⏰",
    description: "การ์ดลิงก์ไปประวัติการแลกรางวัล",
  },
  missions_tabs_list: {
    label: "Missions",
    icon: "🎯",
    description: "แท็บ (ทั้งหมด/สำเร็จแล้ว) + รายการภารกิจ + progress bar + ปุ่ม Claim",
  },
  shop_links_list: {
    label: "Shop Channels",
    icon: "🛒",
    description: "การ์ดช่องทางช้อปออนไลน์ (Shopee/Lazada/LINE/Website — มีสี branding แต่ละแพลตฟอร์ม)",
  },
  wallet_balance_cards: {
    label: "Balance Cards",
    icon: "💳",
    description: "การ์ดยอดคงเหลือ currency หลัก + รอง (ออกแบบสำหรับหน้า Wallet)",
  },
  wallet_transaction_list: {
    label: "Transactions",
    icon: "📋",
    description: "รายการธุรกรรมแต้ม + filter currency + infinite scroll (ออกแบบสำหรับ Wallet)",
  },
  news_list: {
    label: "News",
    icon: "📰",
    description: "รายการข่าวสารเต็มหน้า + expand อ่านเนื้อหา + badge BANNER",
  },
  notifications_list: {
    label: "Notifications",
    icon: "🔔",
    description: "รายการแจ้งเตือน + mark-all read + unread dot + login CTA",
  },
  support_faq_list: {
    label: "Accordion",
    icon: "📂",
    description: "รายการแบบ accordion กดเปิด/ปิดได้ (admin ใส่ items เอง — FAQ/How to/เงื่อนไข ฯลฯ)",
  },
  support_contact_cta: {
    label: "Contact CTA Card",
    icon: "✉️",
    description: "การ์ด CTA ขนาดเล็ก text + ปุ่มลิงก์ (ใช้สำหรับแจ้งปัญหา/ติดต่อเรา)",
  },
  settings_notifications_group: {
    label: "Notification Settings",
    icon: "🔔",
    description: "กลุ่ม toggle switch สำหรับตั้งค่าการแจ้งเตือน (admin ใส่ items เอง)",
  },
  settings_delete_account_card: {
    label: "Delete Account Card",
    icon: "🗑️",
    description: "การ์ดปุ่มลบบัญชี + warning text",
  },
  settings_app_version_footer: {
    label: "App Version Footer",
    icon: "🏷️",
    description: "ข้อความ version ล่างสุดของหน้า (admin แก้ข้อความได้)",
  },
};
