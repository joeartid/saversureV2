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
const RewardsPageHeader = dynamic(() => import("./RewardsPageHeader"));
const RewardsTabsGrid = dynamic(() => import("./RewardsTabsGrid"));
const RewardsHistoryCta = dynamic(() => import("./RewardsHistoryCta"));
const MissionsPageHeader = dynamic(() => import("./MissionsPageHeader"));
const MissionsTabsList = dynamic(() => import("./MissionsTabsList"));
const ShopPageHeader = dynamic(() => import("./ShopPageHeader"));
const ShopLinksList = dynamic(() => import("./ShopLinksList"));
const WalletPageHeader = dynamic(() => import("./WalletPageHeader"));
const WalletBalanceCards = dynamic(() => import("./WalletBalanceCards"));
const WalletTransactionList = dynamic(() => import("./WalletTransactionList"));
const NewsPageHeader = dynamic(() => import("./NewsPageHeader"));
const NewsList = dynamic(() => import("./NewsList"));
const NotificationsPageHeader = dynamic(() => import("./NotificationsPageHeader"));
const NotificationsList = dynamic(() => import("./NotificationsList"));
const BadgesPageHeader = dynamic(() => import("./BadgesPageHeader"));
const BadgesGrid = dynamic(() => import("./BadgesGrid"));
const LeaderboardPageHeader = dynamic(() => import("./LeaderboardPageHeader"));
const LeaderboardList = dynamic(() => import("./LeaderboardList"));
const DonationsPageHeader = dynamic(() => import("./DonationsPageHeader"));
const DonationsHistoryList = dynamic(() => import("./DonationsHistoryList"));
const SupportPageHeader = dynamic(() => import("./SupportPageHeader"));
const SupportFaqList = dynamic(() => import("./SupportFaqList"));
const SupportContactCta = dynamic(() => import("./SupportContactCta"));
const SettingsPageHeader = dynamic(() => import("./SettingsPageHeader"));
const SettingsNotificationsGroup = dynamic(() => import("./SettingsNotificationsGroup"));
const SettingsDeleteAccountCard = dynamic(() => import("./SettingsDeleteAccountCard"));
const SettingsAppVersionFooter = dynamic(() => import("./SettingsAppVersionFooter"));

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
  rewards_page_header: RewardsPageHeader,
  rewards_tabs_grid: RewardsTabsGrid,
  rewards_history_cta: RewardsHistoryCta,
  missions_page_header: MissionsPageHeader,
  missions_tabs_list: MissionsTabsList,
  shop_page_header: ShopPageHeader,
  shop_links_list: ShopLinksList,
  wallet_page_header: WalletPageHeader,
  wallet_balance_cards: WalletBalanceCards,
  wallet_transaction_list: WalletTransactionList,
  news_page_header: NewsPageHeader,
  news_list: NewsList,
  notifications_page_header: NotificationsPageHeader,
  notifications_list: NotificationsList,
  badges_page_header: BadgesPageHeader,
  badges_grid: BadgesGrid,
  leaderboard_page_header: LeaderboardPageHeader,
  leaderboard_list: LeaderboardList,
  donations_page_header: DonationsPageHeader,
  donations_history_list: DonationsHistoryList,
  support_page_header: SupportPageHeader,
  support_faq_list: SupportFaqList,
  support_contact_cta: SupportContactCta,
  settings_page_header: SettingsPageHeader,
  settings_notifications_group: SettingsNotificationsGroup,
  settings_delete_account_card: SettingsDeleteAccountCard,
  settings_app_version_footer: SettingsAppVersionFooter,
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
  rewards_page_header: {
    label: "Rewards — Header",
    icon: "🎁",
    description: "Header gradient หน้ารางวัล + ยอดคงเหลือ currency ของผู้ใช้",
  },
  rewards_tabs_grid: {
    label: "Rewards — Tabs + Grid",
    icon: "🎁",
    description: "แท็บกรองหมวด + grid ของรางวัล (จุฬาเฮิร์บ/พรีเมียม/ไลฟ์สไตล์)",
  },
  rewards_history_cta: {
    label: "Rewards — History CTA",
    icon: "⏰",
    description: "การ์ดลิงก์ไปประวัติการแลกรางวัล (ซ่อนเมื่อยังไม่ login)",
  },
  missions_page_header: {
    label: "Missions — Header",
    icon: "🎯",
    description: "Header gradient หน้าภารกิจ (title + subtitle)",
  },
  missions_tabs_list: {
    label: "Missions — Tabs + List",
    icon: "🎯",
    description: "แท็บ (ทั้งหมด/สำเร็จแล้ว) + รายการภารกิจ + login CTA + claim modal",
  },
  shop_page_header: {
    label: "Shop — Header",
    icon: "🛒",
    description: "Header gradient หน้าช้อปออนไลน์ (title + subtitle)",
  },
  shop_links_list: {
    label: "Shop — Links List",
    icon: "🛒",
    description: "รายการช่องทางช้อปออนไลน์ (Shopee/Lazada/LINE/Website/Emoji/Image)",
  },
  wallet_page_header: {
    label: "Wallet — Header",
    icon: "💰",
    description: "Header gradient หน้ากระเป๋าเงิน (title + subtitle)",
  },
  wallet_balance_cards: {
    label: "Wallet — Balance Cards",
    icon: "💳",
    description: "การ์ดยอดคงเหลือ currency หลัก + รอง (ใช้ useCurrencies)",
  },
  wallet_transaction_list: {
    label: "Wallet — Transaction List",
    icon: "📋",
    description: "รายการธุรกรรมแต้ม + filter ตาม currency + infinite scroll",
  },
  news_page_header: {
    label: "News — Header",
    icon: "📰",
    description: "Header gradient หน้าข่าวสาร (title + subtitle + icon emoji)",
  },
  news_list: {
    label: "News — List",
    icon: "📰",
    description: "รายการข่าวสารเต็มหน้า + expand อ่านเนื้อหา + loading/error/empty states",
  },
  notifications_page_header: {
    label: "Notifications — Header",
    icon: "🔔",
    description: "Sticky header หน้า notifications (back + title)",
  },
  notifications_list: {
    label: "Notifications — List",
    icon: "🔔",
    description: "รายการแจ้งเตือน + mark-all + login CTA + empty/loading states",
  },
  badges_page_header: {
    label: "Badges — Header",
    icon: "🏅",
    description: "Header gradient หน้า badges (title + subtitle)",
  },
  badges_grid: {
    label: "Badges — Grid",
    icon: "🏅",
    description: "Grid 3 คอลัมน์ badges + earned state + login CTA + rarity border",
  },
  leaderboard_page_header: {
    label: "Leaderboard — Header",
    icon: "🏆",
    description: "Header gradient หน้า leaderboard (title + subtitle)",
  },
  leaderboard_list: {
    label: "Leaderboard — List",
    icon: "🏆",
    description: "Period tabs + Top 3 podium + rank list + highlight current user",
  },
  donations_page_header: {
    label: "Donations — Header",
    icon: "💚",
    description: "Header gradient ประวัติการบริจาค + floating decorations",
  },
  donations_history_list: {
    label: "Donations — History List",
    icon: "💚",
    description: "Stat card + browse link + grouped-by-date list + login/empty states",
  },
  support_page_header: {
    label: "Support — Header",
    icon: "❓",
    description: "Header gradient หน้า support (title + subtitle)",
  },
  support_faq_list: {
    label: "Support — FAQ List",
    icon: "❓",
    description: "รายการ FAQ แบบ accordion (admin แก้ items ได้)",
  },
  support_contact_cta: {
    label: "Support — Contact CTA",
    icon: "✉️",
    description: "การ์ด CTA ลิงก์ไปหน้าแจ้งปัญหา",
  },
  settings_page_header: {
    label: "Settings — Header",
    icon: "⚙️",
    description: "Header หน้าตั้งค่า (title + subtitle + back link)",
  },
  settings_notifications_group: {
    label: "Settings — Notifications Group",
    icon: "🔔",
    description: "กลุ่ม toggle การแจ้งเตือน (admin แก้ items ได้, state local)",
  },
  settings_delete_account_card: {
    label: "Settings — Delete Account",
    icon: "🗑️",
    description: "การ์ดปุ่มลบบัญชี + warning text",
  },
  settings_app_version_footer: {
    label: "Settings — App Version",
    icon: "🏷️",
    description: "ข้อความ version ล่างสุด (admin แก้ได้)",
  },
};
