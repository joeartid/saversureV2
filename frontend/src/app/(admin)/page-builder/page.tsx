"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Section {
  id: string;
  type: string;
  order: number;
  visible: boolean;
  props: Record<string, unknown>;
}

interface PageConfig {
  id: string;
  page_slug: string;
  sections: Section[];
  status: string;
  version: number;
}

interface BuiltInPage {
  value: string;
  label: string;
  parent?: string;
}

const BUILT_IN_PAGES: BuiltInPage[] = [
  { value: "home", label: "หน้าแรก (Home)" },
  { value: "scan", label: "หน้าสแกน (Scan)" },
  { value: "rewards", label: "หน้ารางวัล (Rewards)" },
  { value: "missions", label: "หน้าภารกิจ (Missions)" },
  { value: "shop", label: "หน้าช้อปออนไลน์ (Shop)" },
  { value: "wallet", label: "หน้ากระเป๋าเงิน (Wallet)" },
  { value: "history", label: "หน้าประวัติ (History)" },
  { value: "history_redeems", label: "แลกแต้ม", parent: "history" },
  { value: "history_coupons", label: "คูปอง", parent: "history" },
  { value: "history_lucky_draw", label: "ลุ้นโชค", parent: "history" },
  { value: "profile", label: "หน้าโปรไฟล์ (Profile)" },
  { value: "news", label: "หน้าข่าวสาร (News)" },
  { value: "notifications", label: "หน้าแจ้งเตือน (Notifications)" },
  { value: "support", label: "หน้าช่วยเหลือ (Support)" },
  { value: "support_faq", label: "FAQ", parent: "support" },
  { value: "settings", label: "หน้าตั้งค่า (Settings)" },
  { value: "privacy", label: "หน้านโยบายความเป็นส่วนตัว (Privacy)" },
  { value: "terms", label: "หน้าข้อกำหนดและเงื่อนไข (Terms)" },
];

const BUILT_IN_SLUGS = new Set(BUILT_IN_PAGES.map((p) => p.value));

/* ------------------------------------------------------------------ */
/*  Section Type Registry (mirrors consumer sections)                  */
/* ------------------------------------------------------------------ */

interface SectionTypeDef {
  label: string;
  icon: string;
  description: string;
  defaultProps: Record<string, unknown>;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "image" | "items";
  options?: { value: string; label: string }[];
  itemFields?: FieldDef[];
}

const sectionTypes: Record<string, SectionTypeDef> = {
  hero_banner: {
    label: "Hero Banner",
    icon: "🖼️",
    description: "แบนเนอร์ใหญ่หัวหน้า",
    defaultProps: {
      title: "ยินดีต้อนรับ",
      subtitle: "",
      image_url: "",
      cta_text: "",
      cta_link: "/scan",
    },
    fields: [
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "subtitle", label: "คำอธิบาย", type: "text" },
      { key: "image_url", label: "รูปภาพ (URL)", type: "image" },
      { key: "cta_text", label: "ข้อความปุ่ม", type: "text" },
      { key: "cta_link", label: "ลิงก์ปุ่ม", type: "text" },
    ],
  },
  points_summary: {
    label: "Points Summary",
    icon: "🪙",
    description: "แสดงแต้มสะสมและข้อมูลผู้ใช้",
    defaultProps: { show_greeting: true },
    fields: [
      { key: "show_greeting", label: "แสดงคำทักทาย", type: "boolean" },
    ],
  },
  banner_carousel: {
    label: "Banner Carousel",
    icon: "🎠",
    description: "Slideshow แบนเนอร์",
    defaultProps: { auto_play: true, interval_ms: 5000, items: [] },
    fields: [
      { key: "auto_play", label: "เลื่อนอัตโนมัติ", type: "boolean" },
      { key: "interval_ms", label: "ความเร็ว (ms)", type: "number" },
      {
        key: "items",
        label: "รายการแบนเนอร์",
        type: "items",
        itemFields: [
          { key: "image_url", label: "รูปภาพ URL", type: "image" },
          { key: "link", label: "ลิงก์", type: "text" },
          { key: "alt", label: "คำอธิบายภาพ", type: "text" },
        ],
      },
    ],
  },
  feature_menu: {
    label: "Feature Menu",
    icon: "🔲",
    description: "Grid ไอคอนเมนูลัด",
    defaultProps: {
      columns: 4,
      items: [
        { icon: "scan", label: "สแกน QR", link: "/scan" },
        { icon: "gift", label: "แลกรางวัล", link: "/rewards" },
        { icon: "history", label: "ประวัติ", link: "/history" },
        { icon: "user", label: "โปรไฟล์", link: "/profile" },
      ],
    },
    fields: [
      { key: "columns", label: "จำนวนคอลัมน์", type: "number" },
      {
        key: "items",
        label: "รายการเมนู",
        type: "items",
        itemFields: [
          {
            key: "icon",
            label: "ไอคอน",
            type: "select",
            options: [
              { value: "scan", label: "Scan" },
              { value: "gift", label: "Gift" },
              { value: "history", label: "History" },
              { value: "user", label: "User" },
              { value: "news", label: "News" },
              { value: "star", label: "Star" },
              { value: "heart", label: "Heart" },
              { value: "trophy", label: "Trophy" },
            ],
          },
          { key: "label", label: "ชื่อเมนู", type: "text" },
          { key: "link", label: "ลิงก์", type: "text" },
        ],
      },
    ],
  },
  promo_banner: {
    label: "Promo Banner",
    icon: "🎉",
    description: "แถบโปรโมชั่น",
    defaultProps: {
      title: "โปรโมชั่น",
      description: "",
      image_url: "",
      link: "/rewards",
      bg_color: "",
      emoji: "🎉",
    },
    fields: [
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "description", label: "คำอธิบาย", type: "textarea" },
      { key: "image_url", label: "รูปภาพ (URL)", type: "image" },
      { key: "link", label: "ลิงก์", type: "text" },
      { key: "bg_color", label: "สีพื้นหลัง", type: "text" },
      { key: "emoji", label: "Emoji", type: "text" },
    ],
  },
  rich_text: {
    label: "Rich Text",
    icon: "📝",
    description: "เนื้อหา HTML/ข้อความ",
    defaultProps: { title: "", content: "", alignment: "left" },
    fields: [
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "content", label: "เนื้อหา (HTML)", type: "textarea" },
      {
        key: "alignment",
        label: "การจัดตำแหน่ง",
        type: "select",
        options: [
          { value: "left", label: "ซ้าย" },
          { value: "center", label: "กลาง" },
          { value: "right", label: "ขวา" },
        ],
      },
    ],
  },
  recent_news: {
    label: "Recent News",
    icon: "📰",
    description: "ข่าวสารล่าสุด",
    defaultProps: { limit: 3, show_image: true },
    fields: [
      { key: "limit", label: "จำนวนข่าว", type: "number" },
      { key: "show_image", label: "แสดงรูปภาพ", type: "boolean" },
    ],
  },
  feature_list: {
    label: "Feature List",
    icon: "📋",
    description: "รายการ feature พร้อมไอคอน",
    defaultProps: {
      heading: "",
      items: [
        { icon: "shield", title: "ปลอดภัย", description: "เชื่อมต่อผ่าน LINE" },
        { icon: "bolt", title: "สะสมแต้มง่าย", description: "สแกน QR Code รับแต้มทันที" },
      ],
    },
    fields: [
      { key: "heading", label: "หัวข้อ", type: "text" },
      {
        key: "items",
        label: "รายการ",
        type: "items",
        itemFields: [
          {
            key: "icon",
            label: "ไอคอน",
            type: "select",
            options: [
              { value: "shield", label: "Shield" },
              { value: "bolt", label: "Bolt" },
              { value: "sparkle", label: "Sparkle" },
            ],
          },
          { key: "title", label: "หัวข้อ", type: "text" },
          { key: "description", label: "คำอธิบาย", type: "text" },
        ],
      },
    ],
  },
  spacer: {
    label: "Spacer",
    icon: "↕️",
    description: "ช่องว่าง",
    defaultProps: { height: 16 },
    fields: [{ key: "height", label: "ความสูง (px)", type: "number" }],
  },
  profile_header_card: {
    label: "Profile Header Card",
    icon: "👤",
    description: "การ์ดโปรไฟล์ + tier badge + verified badge",
    defaultProps: {
      show_tier: true,
      show_verified_badge: true,
      show_completed_badge: true,
      fallback_name: "สมาชิก",
    },
    fields: [
      { key: "show_tier", label: "แสดง Tier Badge", type: "boolean" },
      { key: "show_verified_badge", label: "แสดง Badge ยืนยันเบอร์", type: "boolean" },
      { key: "show_completed_badge", label: "แสดง Badge สถานะข้อมูล", type: "boolean" },
      { key: "fallback_name", label: "ชื่อ default (กรณีไม่มีชื่อ)", type: "text" },
    ],
  },
  profile_tier_progress: {
    label: "Tier Progress",
    icon: "🏆",
    description: "แถบความคืบหน้า tier ระดับสมาชิก",
    defaultProps: { show_next_tier_hint: true },
    fields: [
      { key: "show_next_tier_hint", label: "แสดงข้อความ \"อีกกี่แต้มถึงระดับถัดไป\"", type: "boolean" },
    ],
  },
  profile_points_card: {
    label: "Points Card",
    icon: "💰",
    description: "การ์ดแต้มสะสม + ปุ่มใช้แต้ม",
    defaultProps: {
      show_use_button: true,
      show_summary: true,
      cta_text: "ใช้แต้ม",
      cta_link: "/history",
      label: "แต้มสะสมใช้งานได้",
    },
    fields: [
      { key: "show_use_button", label: "แสดงปุ่มใช้แต้ม", type: "boolean" },
      { key: "show_summary", label: "แสดงสรุป (ใช้ไป/สะสมทั้งหมด)", type: "boolean" },
      { key: "label", label: "ข้อความหัวข้อ", type: "text" },
      { key: "cta_text", label: "ข้อความปุ่ม", type: "text" },
      { key: "cta_link", label: "ลิงก์ปุ่ม", type: "text" },
    ],
  },
  profile_warning_alert: {
    label: "Warning Alert",
    icon: "⚠️",
    description: "แจ้งเตือน (แสดงตามเงื่อนไข)",
    defaultProps: {
      icon: "⚠️",
      title: "กรอกข้อมูลให้ครบถ้วน",
      description: "ยืนยันรหัส OTP และข้อมูลเพื่อรับสิทธิประโยชน์",
      cta_text: "รีบทำเลย",
      cta_link: "/register/complete",
      show_if: "profile_incomplete",
    },
    fields: [
      { key: "icon", label: "Emoji", type: "text" },
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "description", label: "คำอธิบาย", type: "textarea" },
      { key: "cta_text", label: "ข้อความปุ่ม", type: "text" },
      { key: "cta_link", label: "ลิงก์ปุ่ม", type: "text" },
      {
        key: "show_if",
        label: "เงื่อนไขแสดง",
        type: "select",
        options: [
          { value: "profile_incomplete", label: "ข้อมูลไม่ครบ" },
          { value: "phone_unverified", label: "ยังไม่ยืนยันเบอร์" },
          { value: "always", label: "แสดงเสมอ" },
        ],
      },
    ],
  },
  profile_menu_group: {
    label: "Menu Group",
    icon: "📋",
    description: "กลุ่มเมนูลิงก์ (สามารถมีหลาย group)",
    defaultProps: {
      title: "บัญชีและการทำรายการ",
      items: [
        { icon: "user", label: "ข้อมูลส่วนตัว", href: "/profile/edit", color: "text-blue-500", bg: "bg-blue-50" },
        { icon: "list", label: "สมุดที่อยู่จัดส่ง", href: "/profile/addresses", color: "text-amber-500", bg: "bg-amber-50" },
        { icon: "history", label: "ประวัติแต้มและกิจกรรม", href: "/history", color: "text-[var(--jh-green)]", bg: "bg-green-50" },
      ],
    },
    fields: [
      { key: "title", label: "ชื่อกลุ่ม", type: "text" },
      {
        key: "items",
        label: "รายการเมนู",
        type: "items",
        itemFields: [
          {
            key: "icon",
            label: "ไอคอน",
            type: "select",
            options: [
              { value: "user", label: "User" },
              { value: "history", label: "History" },
              { value: "gift", label: "Gift" },
              { value: "help", label: "Help" },
              { value: "list", label: "List" },
              { value: "settings", label: "Settings" },
              { value: "docs", label: "Docs" },
            ],
          },
          { key: "label", label: "ข้อความ", type: "text" },
          { key: "href", label: "ลิงก์", type: "text" },
          { key: "color", label: "สีไอคอน (Tailwind class)", type: "text" },
          { key: "bg", label: "สีพื้นหลังไอคอน (Tailwind class)", type: "text" },
        ],
      },
    ],
  },
  profile_logout_button: {
    label: "Logout Button",
    icon: "🚪",
    description: "ปุ่มออกจากระบบ (สีแดง)",
    defaultProps: {
      label: "ออกจากระบบ",
      confirm_message: "",
    },
    fields: [
      { key: "label", label: "ข้อความปุ่ม", type: "text" },
      { key: "confirm_message", label: "ข้อความยืนยัน (เว้นว่าง = ไม่ confirm)", type: "text" },
    ],
  },
  history_stat_summary: {
    label: "Stat Summary (4 คอลัมน์)",
    icon: "📊",
    description: "การ์ดสรุป 4-column",
    defaultProps: {
      show_success_count: true,
      show_total_points: true,
      show_balance: true,
      show_total_scans: true,
      balance_link: "/wallet",
    },
    fields: [
      { key: "show_success_count", label: "แสดงคอลัมน์ \"สแกนสำเร็จ\"", type: "boolean" },
      { key: "show_total_points", label: "แสดงคอลัมน์ \"แต้มสะสม\"", type: "boolean" },
      { key: "show_balance", label: "แสดงคอลัมน์ \"ยอดคงเหลือ\"", type: "boolean" },
      { key: "show_total_scans", label: "แสดงคอลัมน์ \"ทั้งหมด\"", type: "boolean" },
      { key: "balance_link", label: "ลิงก์คลิกยอดคงเหลือ", type: "text" },
    ],
  },
  history_tabs_nav: {
    label: "History Tabs Nav",
    icon: "🗂️",
    description: "แถบแท็บ (สะสม/แลก/คูปอง/ลุ้นโชค)",
    defaultProps: { overlap: true },
    fields: [
      { key: "overlap", label: "ซ้อนขอบ bg สีเขียว (-mt-7)", type: "boolean" },
    ],
  },
  history_scan_list: {
    label: "Scans",
    icon: "📋",
    description: "รายการสแกน + infinite scroll",
    defaultProps: {
      page_size: 30,
      group_by_date: true,
      empty_message: "ยังไม่มีประวัติ",
      empty_cta_text: "สแกนสะสมแต้ม",
      empty_cta_link: "/scan",
    },
    fields: [
      { key: "page_size", label: "จำนวนต่อหน้า", type: "number" },
      { key: "group_by_date", label: "จัดกลุ่มตามวันที่", type: "boolean" },
      { key: "empty_message", label: "ข้อความเมื่อไม่มีข้อมูล", type: "text" },
      { key: "empty_cta_text", label: "ข้อความปุ่ม (empty state)", type: "text" },
      { key: "empty_cta_link", label: "ลิงก์ปุ่ม (empty state)", type: "text" },
    ],
  },
  home_news_banner_carousel: {
    label: "News Banner Carousel",
    icon: "🎠",
    description: "Banner carousel ดึงข่าวล่าสุดจาก API",
    defaultProps: {
      limit: 5,
      auto_play: true,
      interval_ms: 3000,
      show_dots: true,
    },
    fields: [
      { key: "limit", label: "จำนวนข่าวที่ดึง", type: "number" },
      { key: "auto_play", label: "เลื่อนอัตโนมัติ", type: "boolean" },
      { key: "interval_ms", label: "ความเร็วเลื่อน (ms)", type: "number" },
      { key: "show_dots", label: "แสดงจุดนำทาง", type: "boolean" },
    ],
  },
  home_section_heading: {
    label: "Section Heading",
    icon: "📝",
    description: "หัวข้อ section (title + subtitle)",
    defaultProps: {
      title: "แลกสิทธิพิเศษสำหรับคุณ",
      subtitle: "",
      align: "left",
    },
    fields: [
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "subtitle", label: "คำอธิบาย (ไม่บังคับ)", type: "text" },
      {
        key: "align",
        label: "การจัดตำแหน่ง",
        type: "select",
        options: [
          { value: "left", label: "ซ้าย" },
          { value: "center", label: "กลาง" },
        ],
      },
    ],
  },
  home_rewards_tabs: {
    label: "Home — Rewards พร้อม Tabs",
    icon: "🎁",
    description: "แสดงรางวัลพร้อมแท็บหลายหมวด + ลุ้นโชค",
    defaultProps: {
      limit: 20,
      default_tab: "julaherb",
      show_flash_badge: true,
      tabs: [
        { key: "julaherb", label: "สินค้าจุฬาเฮิร์บ", source: "rewards-product" },
        { key: "premium", label: "สินค้าพรีเมียม", source: "rewards-premium" },
        { key: "lifestyle", label: "ไลฟ์สไตล์", source: "rewards-lifestyle" },
        { key: "lucky", label: "ลุ้นโชค", source: "lucky-draw" },
      ],
    },
    fields: [
      { key: "limit", label: "จำนวนรางวัลที่ดึง", type: "number" },
      { key: "default_tab", label: "แท็บเริ่มต้น (key)", type: "text" },
      { key: "show_flash_badge", label: "แสดง FLASH badge", type: "boolean" },
      {
        key: "tabs",
        label: "รายการแท็บ",
        type: "items",
        itemFields: [
          { key: "key", label: "Key (ภาษาอังกฤษ ไม่ซ้ำ)", type: "text" },
          { key: "label", label: "ชื่อแท็บ", type: "text" },
          {
            key: "source",
            label: "แหล่งข้อมูล",
            type: "select",
            options: [
              { value: "rewards-product", label: "รางวัล: สินค้าจุฬาเฮิร์บ" },
              { value: "rewards-premium", label: "รางวัล: สินค้าพรีเมียม" },
              { value: "rewards-lifestyle", label: "รางวัล: ไลฟ์สไตล์" },
              { value: "lucky-draw", label: "ลุ้นโชค" },
            ],
          },
        ],
      },
    ],
  },
  home_lucky_draw_list: {
    label: "Home — ลุ้นโชค",
    icon: "🏆",
    description: "รายการกิจกรรมลุ้นโชค ดึงจาก API",
    defaultProps: {
      limit: 20,
      show_end_date: false,
    },
    fields: [
      { key: "limit", label: "จำนวนรายการ", type: "number" },
      { key: "show_end_date", label: "แสดงวันสิ้นสุด", type: "boolean" },
    ],
  },
  rewards_tabs_grid: {
    label: "Rewards — Tabs + Grid",
    icon: "🎁",
    description: "แท็บกรองหมวด + grid ของรางวัล (จุฬาเฮิร์บ/พรีเมียม/ไลฟ์สไตล์)",
    defaultProps: {
      limit: 50,
      default_tab: "julaherb",
      show_flash_badge: true,
      show_stock_warning: true,
      empty_message: "ยังไม่มีของรางวัลในหมวดนี้",
      tabs: [
        { id: "julaherb", label: "สินค้าจุฬาเฮิร์บ", icon: "🌱", filter_type: "product" },
        { id: "premium", label: "สินค้าพรีเมียม", icon: "💎", filter_type: "premium" },
        { id: "lifestyle", label: "ไลฟ์สไตล์", icon: "🎟️", filter_type: "lifestyle" },
      ],
    },
    fields: [
      { key: "limit", label: "จำนวนรางวัลที่ดึง", type: "number" },
      { key: "default_tab", label: "แท็บเริ่มต้น (id)", type: "text" },
      { key: "show_flash_badge", label: "แสดง FLASH badge", type: "boolean" },
      { key: "show_stock_warning", label: "แสดงเตือนสต็อกเหลือน้อย", type: "boolean" },
      { key: "empty_message", label: "ข้อความเมื่อไม่มีรางวัล", type: "text" },
      {
        key: "tabs",
        label: "รายการแท็บ",
        type: "items",
        itemFields: [
          { key: "id", label: "ID (ภาษาอังกฤษ ไม่ซ้ำ)", type: "text" },
          { key: "label", label: "ชื่อแท็บ", type: "text" },
          { key: "icon", label: "Emoji ไอคอน", type: "text" },
          {
            key: "filter_type",
            label: "ประเภทที่กรอง",
            type: "select",
            options: [
              { value: "product", label: "สินค้าจุฬาเฮิร์บ (type=product)" },
              { value: "premium", label: "สินค้าพรีเมียม (type=premium)" },
              { value: "lifestyle", label: "ไลฟ์สไตล์ (coupon/digital/ticket)" },
            ],
          },
        ],
      },
    ],
  },
  rewards_history_cta: {
    label: "Rewards — History CTA",
    icon: "⏰",
    description: "การ์ดลิงก์ไปประวัติการแลกรางวัล (ซ่อนเมื่อยังไม่ login)",
    defaultProps: {
      title: "ประวัติการแลกรางวัล",
      subtitle: "ดูสถานะการจัดส่งและคูปอง",
      link: "/history/redeems",
      hide_if_guest: true,
    },
    fields: [
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "subtitle", label: "คำอธิบาย", type: "text" },
      { key: "link", label: "ลิงก์ปลายทาง", type: "text" },
      { key: "hide_if_guest", label: "ซ่อนเมื่อยังไม่ login", type: "boolean" },
    ],
  },
  shop_links_list: {
    label: "Shop Channels",
    icon: "🛒",
    description: "รายการช่องทางช้อปออนไลน์ (admin เพิ่ม/ลบ/เรียงได้)",
    defaultProps: {
      items: [
        {
          icon_type: "shopee",
          icon_value: "",
          title: "Julaherb_officialshop",
          link: "https://shopee.co.th/julaherb_officialshop",
          border_color: "#EE4D2D",
        },
        {
          icon_type: "lazada",
          icon_value: "",
          title: "Jula's Herb",
          link: "https://www.lazada.co.th/shop/julas-herb",
          border_color: "#0F146D",
        },
        {
          icon_type: "website",
          icon_value: "",
          title: "www.julaherbshop.com",
          link: "https://www.julaherbshop.com",
          border_color: "#3C9B4D",
        },
        {
          icon_type: "line",
          icon_value: "",
          title: "ติดตะกร้าจุฬาเฮิร์บ (LINE OpenChat)",
          link: "https://line.me/th/",
          border_color: "#00B900",
        },
        {
          icon_type: "line_admin",
          icon_value: "",
          title: "สั่งซื้อที่แอดมิน",
          link: "https://line.me/R/ti/p/@julaherb",
          border_color: "#00B900",
        },
      ],
    },
    fields: [
      {
        key: "items",
        label: "รายการช่องทางช้อปออนไลน์",
        type: "items",
        itemFields: [
          {
            key: "icon_type",
            label: "ประเภทไอคอน",
            type: "select",
            options: [
              { value: "shopee", label: "Shopee" },
              { value: "lazada", label: "Lazada" },
              { value: "line", label: "LINE (วงกลมเขียว)" },
              { value: "line_admin", label: "LINE Admin (มีคำว่า LINE)" },
              { value: "website", label: "Website (ใบไม้เขียว)" },
              { value: "emoji", label: "Emoji (ใส่เอง)" },
              { value: "image", label: "รูปภาพ (ใส่ URL)" },
            ],
          },
          {
            key: "icon_value",
            label: "ค่าไอคอน (ใช้เมื่อเลือก emoji หรือ image)",
            type: "text",
          },
          { key: "title", label: "ชื่อที่แสดง", type: "text" },
          { key: "link", label: "ลิงก์ปลายทาง (URL)", type: "text" },
          { key: "border_color", label: "สีขอบการ์ด (hex)", type: "text" },
        ],
      },
    ],
  },
  missions_tabs_list: {
    label: "Missions",
    icon: "🎯",
    description: "แท็บ + รายการภารกิจ + login CTA + claim modal",
    defaultProps: {
      show_login_cta: true,
      login_cta_text: "เข้าสู่ระบบเพื่อดูความคืบหน้าภารกิจ",
      empty_all_text: "ยังไม่มีภารกิจปัจจุบัน",
      empty_completed_text: "ยังไม่มีภารกิจที่สำเร็จแล้ว",
      default_tab: "all",
      show_claim_modal: true,
      tabs: [
        { id: "all", label: "ทั้งหมด" },
        { id: "completed", label: "สำเร็จแล้ว" },
      ],
    },
    fields: [
      { key: "show_login_cta", label: "แสดง login CTA เมื่อยังไม่ login", type: "boolean" },
      { key: "login_cta_text", label: "ข้อความ login CTA", type: "text" },
      { key: "empty_all_text", label: "ข้อความเมื่อไม่มีภารกิจ (ทั้งหมด)", type: "text" },
      { key: "empty_completed_text", label: "ข้อความเมื่อไม่มีภารกิจสำเร็จ", type: "text" },
      { key: "default_tab", label: "แท็บเริ่มต้น (id)", type: "text" },
      { key: "show_claim_modal", label: "แสดง claim modal", type: "boolean" },
      {
        key: "tabs",
        label: "รายการแท็บ",
        type: "items",
        itemFields: [
          { key: "id", label: "ID (all / completed)", type: "text" },
          { key: "label", label: "ชื่อแท็บ", type: "text" },
        ],
      },
    ],
  },
  wallet_balance_cards: {
    label: "Balance Cards",
    icon: "💳",
    description: "การ์ดยอดคงเหลือ currency หลัก + รอง (auto จาก useCurrencies)",
    defaultProps: {
      show_earned_spent: true,
      show_secondary: true,
      empty_state_text: "เข้าสู่ระบบเพื่อดูกระเป๋าเงินของคุณ",
      not_logged_in_title: "กรุณาเข้าสู่ระบบ",
      no_balance_title: "ยังไม่มียอดคงเหลือ",
      no_balance_text: "สแกนคิวอาร์โค้ดเพื่อเริ่มสะสมแต้ม",
      no_balance_cta_text: "สแกนสะสมแต้ม",
    },
    fields: [
      { key: "show_earned_spent", label: "แสดงแถบสะสม/ใช้ไป", type: "boolean" },
      { key: "show_secondary", label: "แสดง currency รอง", type: "boolean" },
      { key: "empty_state_text", label: "ข้อความเมื่อยังไม่ login", type: "text" },
      { key: "not_logged_in_title", label: "หัวข้อเมื่อยังไม่ login", type: "text" },
      { key: "no_balance_title", label: "หัวข้อเมื่อไม่มียอดคงเหลือ", type: "text" },
      { key: "no_balance_text", label: "คำอธิบายเมื่อไม่มียอดคงเหลือ", type: "text" },
      { key: "no_balance_cta_text", label: "ข้อความปุ่ม CTA", type: "text" },
    ],
  },
  wallet_transaction_list: {
    label: "Transactions",
    icon: "📋",
    description: "รายการธุรกรรมแต้ม + filter ตาม currency + infinite scroll",
    defaultProps: {
      title: "ประวัติธุรกรรม",
      page_size: 30,
      show_currency_filter: true,
      empty_text: "ยังไม่มีธุรกรรม",
      filter_all_label: "ทั้งหมด",
    },
    fields: [
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "page_size", label: "จำนวนรายการต่อหน้า", type: "number" },
      { key: "show_currency_filter", label: "แสดงแท็บ filter currency", type: "boolean" },
      { key: "empty_text", label: "ข้อความเมื่อไม่มีรายการ", type: "text" },
      { key: "filter_all_label", label: "ข้อความแท็บ 'ทั้งหมด'", type: "text" },
    ],
  },
  news_list: {
    label: "News",
    icon: "📰",
    description: "รายการข่าวสารเต็มหน้า + expand อ่านเนื้อหา + loading/error/empty states",
    defaultProps: {
      limit: 50,
      empty_title: "ยังไม่มีข่าวสารใหม่",
      empty_text: "ติดตามโปรโมชั่น แคมเปญพิเศษ\nและกิจกรรมดีๆ ได้ที่นี่ เร็วๆ นี้",
      empty_cta_label: "กลับหน้าหลัก",
      empty_cta_link: "/",
      error_title: "ไม่สามารถโหลดข่าวสารได้",
      error_text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      retry_label: "ลองใหม่",
      read_more_label: "อ่านเพิ่มเติม",
      collapse_label: "ย่อ",
      show_banner_badge: true,
    },
    fields: [
      { key: "limit", label: "จำนวนข่าวสูงสุด", type: "number" },
      { key: "show_banner_badge", label: "แสดง badge BANNER", type: "boolean" },
      { key: "read_more_label", label: "ข้อความ 'อ่านเพิ่มเติม'", type: "text" },
      { key: "collapse_label", label: "ข้อความ 'ย่อ'", type: "text" },
      { key: "empty_title", label: "หัวข้อเมื่อว่าง", type: "text" },
      { key: "empty_text", label: "ข้อความเมื่อว่าง", type: "textarea" },
      { key: "empty_cta_label", label: "ปุ่ม CTA (เมื่อว่าง)", type: "text" },
      { key: "empty_cta_link", label: "ลิงก์ CTA (เมื่อว่าง)", type: "text" },
      { key: "error_title", label: "หัวข้อเมื่อ error", type: "text" },
      { key: "error_text", label: "ข้อความเมื่อ error", type: "text" },
      { key: "retry_label", label: "ปุ่ม 'ลองใหม่'", type: "text" },
    ],
  },
  notifications_list: {
    label: "Notifications",
    icon: "🔔",
    description: "รายการแจ้งเตือน + mark-all + login CTA + empty/loading states",
    defaultProps: {
      mark_all_label: "Mark all read",
      marking_label: "...",
      empty_text: "No notifications yet",
      login_required_text: "Please login to view notifications",
      login_label: "Login",
      login_href: "/login",
      time_just_now: "Just now",
      time_minute_suffix: "m ago",
      time_hour_suffix: "h ago",
      time_day_suffix: "d ago",
    },
    fields: [
      { key: "mark_all_label", label: "ปุ่ม 'Mark all read'", type: "text" },
      { key: "marking_label", label: "ข้อความระหว่าง mark-all", type: "text" },
      { key: "empty_text", label: "ข้อความเมื่อว่าง", type: "text" },
      { key: "login_required_text", label: "ข้อความให้ล็อกอิน", type: "text" },
      { key: "login_label", label: "ปุ่ม Login", type: "text" },
      { key: "login_href", label: "ลิงก์หน้า Login", type: "text" },
      { key: "time_just_now", label: "ข้อความ 'Just now'", type: "text" },
      { key: "time_minute_suffix", label: "suffix นาที (m ago)", type: "text" },
      { key: "time_hour_suffix", label: "suffix ชั่วโมง (h ago)", type: "text" },
      { key: "time_day_suffix", label: "suffix วัน (d ago)", type: "text" },
    ],
  },
  support_faq_list: {
    label: "Accordion",
    icon: "❓",
    description: "รายการ FAQ accordion (แก้ items ได้)",
    defaultProps: {
      items: [],
      empty_text: "ยังไม่มีคำถามที่พบบ่อย",
    },
    fields: [
      { key: "empty_text", label: "ข้อความเมื่อว่าง", type: "text" },
      {
        key: "items",
        label: "รายการ FAQ",
        type: "items",
        itemFields: [
          { key: "q", label: "คำถาม", type: "text" },
          { key: "a", label: "คำตอบ", type: "textarea" },
        ],
      },
    ],
  },
  support_contact_cta: {
    label: "Contact CTA Card",
    icon: "✉️",
    description: "การ์ด CTA ลิงก์ไปหน้าแจ้งปัญหา",
    defaultProps: {
      text: "ไม่พบคำตอบที่ต้องการ หรือต้องการแจ้งปัญหา?",
      cta_label: "ไปหน้าแจ้งปัญหา",
      cta_href: "/support/history?tab=ticket",
    },
    fields: [
      { key: "text", label: "ข้อความ", type: "text" },
      { key: "cta_label", label: "ข้อความปุ่ม", type: "text" },
      { key: "cta_href", label: "ลิงก์ปุ่ม", type: "text" },
    ],
  },
  settings_notifications_group: {
    label: "Notification Settings",
    icon: "🔔",
    description: "กลุ่ม toggle การแจ้งเตือน (state local)",
    defaultProps: {
      group_title: "การแจ้งเตือน (Push Notifications)",
      items: [],
    },
    fields: [
      { key: "group_title", label: "หัวข้อกลุ่ม", type: "text" },
      {
        key: "items",
        label: "รายการ Toggle",
        type: "items",
        itemFields: [
          { key: "label", label: "ป้ายชื่อ", type: "text" },
          { key: "description", label: "คำอธิบาย", type: "textarea" },
          { key: "default_on", label: "เปิดเป็นค่าเริ่มต้น", type: "boolean" },
          { key: "locked", label: "ล็อก (ปิดไม่ได้)", type: "boolean" },
        ],
      },
    ],
  },
  settings_delete_account_card: {
    label: "Delete Account Card",
    icon: "🗑️",
    description: "การ์ดปุ่มลบบัญชี + warning",
    defaultProps: {
      group_title: "ลบบัญชีผู้ใช้",
      button_label: "แจ้งขอลบบัญชีผู้ใช้",
      warning_text: "หากลบบัญชี แต้มและข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้",
      cta_href: "",
    },
    fields: [
      { key: "group_title", label: "หัวข้อกลุ่ม", type: "text" },
      { key: "button_label", label: "ข้อความปุ่ม", type: "text" },
      { key: "warning_text", label: "ข้อความเตือน", type: "textarea" },
      { key: "cta_href", label: "ลิงก์ปุ่ม (เว้นว่าง = ไม่มี)", type: "text" },
    ],
  },
  settings_app_version_footer: {
    label: "App Version Footer",
    icon: "🏷️",
    description: "ข้อความ version ล่างสุด",
    defaultProps: {
      text: "APP VERSION 2.0.1 (Build 491)",
    },
    fields: [
      { key: "text", label: "ข้อความ version", type: "text" },
    ],
  },
  section_header: {
    label: "Header",
    icon: "📑",
    description:
      "Header ส่วนหัวของหน้า ใช้ได้ทุกหน้า (เลือก variant/decoration/icon/title size ได้)",
    defaultProps: {
      variant: "gradient",
      title: "หัวข้อหน้า",
      subtitle: "",
      back_href: "",
      decoration: "circles",
      title_size: "lg",
      icon_style: "none",
      icon_emoji: "",
      gradient_from: "#3C9B4D",
      gradient_to: "#7DBD48",
      show_balance: false,
      show_scan_count: false,
    },
    fields: [
      {
        key: "variant",
        label: "รูปแบบ Layout",
        type: "select",
        options: [
          { value: "gradient", label: "Gradient (มาตรฐาน — มีพื้นหลัง gradient เขียว)" },
          { value: "sticky", label: "Sticky (แถบขาวติดด้านบน + ปุ่มย้อนกลับ)" },
          { value: "basic", label: "Basic (gradient + ปุ่มย้อนกลับเล็ก)" },
        ],
      },
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "subtitle", label: "คำอธิบาย", type: "text" },
      { key: "back_href", label: "ลิงก์ปุ่มย้อนกลับ (เว้นว่าง = ไม่มี)", type: "text" },
      {
        key: "title_size",
        label: "ขนาดหัวข้อ (เฉพาะ gradient)",
        type: "select",
        options: [
          { value: "lg", label: "ใหญ่ (text-[40px] — default)" },
          { value: "md", label: "กลาง (text-3xl — ใช้กับหน้า rewards)" },
          { value: "sm", label: "เล็ก (text-xl — ใช้กับหน้า news)" },
        ],
      },
      {
        key: "decoration",
        label: "ลวดลายพื้นหลัง (เฉพาะ gradient)",
        type: "select",
        options: [
          { value: "circles", label: "วงกลมลอย (default)" },
          { value: "leaf", label: "ใบไม้ (missions/shop)" },
          { value: "simple", label: "เรียบ (wallet — 2 วงกลม)" },
          { value: "none", label: "ไม่มีลวดลาย" },
        ],
      },
      {
        key: "icon_style",
        label: "ไอคอนข้างหัวข้อ",
        type: "select",
        options: [
          { value: "none", label: "ไม่มี" },
          { value: "emoji_inline", label: "Emoji inline (ใช้กับ news)" },
          { value: "help_circle", label: "วงกลม ? (ใช้กับ support)" },
        ],
      },
      { key: "icon_emoji", label: "Emoji (เมื่อเลือก emoji_inline)", type: "text" },
      { key: "gradient_from", label: "สี gradient เริ่ม (hex)", type: "text" },
      { key: "gradient_to", label: "สี gradient จบ (hex)", type: "text" },
      {
        key: "show_balance",
        label: "แสดง Balance pills (เฉพาะ logged in) — ใช้กับ rewards",
        type: "boolean",
      },
      {
        key: "show_scan_count",
        label: "แสดงจำนวนสแกน (เฉพาะ logged in) — ใช้กับ history",
        type: "boolean",
      },
    ],
  },
  history_redeems_list: {
    label: "History — Redeems",
    icon: "📦",
    description: "รายการแลกของรางวัลประเภทจัดส่ง/รับหน้าร้าน — ดึง API",
    defaultProps: {
      empty_title: "ยังไม่มีประวัติการแลกรางวัล",
      empty_text: "สะสมแต้มเพื่อนำมาแลกของรางวัลและสิทธิพิเศษ",
      empty_cta_label: "ดูของรางวัล",
      empty_cta_link: "/rewards",
      error_title: "ไม่สามารถโหลดข้อมูลได้",
      error_text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      retry_label: "ลองใหม่",
    },
    fields: [
      { key: "empty_title", label: "หัวข้อ empty state", type: "text" },
      { key: "empty_text", label: "ข้อความ empty state", type: "textarea" },
      { key: "empty_cta_label", label: "ข้อความปุ่ม CTA", type: "text" },
      { key: "empty_cta_link", label: "ลิงก์ปุ่ม CTA", type: "text" },
      { key: "error_title", label: "หัวข้อ error state", type: "text" },
      { key: "error_text", label: "ข้อความ error state", type: "text" },
      { key: "retry_label", label: "ข้อความปุ่มลองใหม่", type: "text" },
    ],
  },
  history_coupons_list: {
    label: "History — Coupons",
    icon: "🎫",
    description: "รายการคูปอง/ดิจิทัล/ตั๋ว พร้อมปุ่มใช้คูปอง (QR/Barcode) — ดึง API",
    defaultProps: {
      empty_title: "ยังไม่มีคูปองหรือสิทธิ์ดิจิทัล",
      empty_text: "แลกแต้มเพื่อรับคูปอง ตั๋ว หรือของรางวัลดิจิทัลที่หน้ารางวัล",
      empty_cta_label: "ไปที่หน้ารางวัล",
      empty_cta_link: "/rewards",
      error_title: "ไม่สามารถโหลดข้อมูลได้",
      error_text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      retry_label: "ลองใหม่",
      active_section_label: "ใช้ได้",
      used_section_label: "ใช้แล้ว / หมดอายุ",
    },
    fields: [
      { key: "empty_title", label: "หัวข้อ empty state", type: "text" },
      { key: "empty_text", label: "ข้อความ empty state", type: "textarea" },
      { key: "empty_cta_label", label: "ข้อความปุ่ม CTA", type: "text" },
      { key: "empty_cta_link", label: "ลิงก์ปุ่ม CTA", type: "text" },
      { key: "error_title", label: "หัวข้อ error state", type: "text" },
      { key: "error_text", label: "ข้อความ error state", type: "text" },
      { key: "retry_label", label: "ข้อความปุ่มลองใหม่", type: "text" },
      { key: "active_section_label", label: "หัวข้อกลุ่ม \"ใช้ได้\"", type: "text" },
      { key: "used_section_label", label: "หัวข้อกลุ่ม \"ใช้แล้ว/หมดอายุ\"", type: "text" },
    ],
  },
  history_lucky_draw_list: {
    label: "History — Lucky Draw",
    icon: "🎟️",
    description: "รายการตั๋วลุ้นโชคของผู้ใช้ — ดึง API",
    defaultProps: {
      empty_title: "ยังไม่มีสิทธิ์ลุ้นโชค",
      empty_text: "ร่วมกิจกรรมลุ้นโชคเพื่อรับสิทธิ์",
      empty_cta_label: "ดูกิจกรรม",
      empty_cta_link: "/missions",
      error_title: "ไม่สามารถโหลดข้อมูลได้",
      error_text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      retry_label: "ลองใหม่",
      count_label: "พบ {n} สิทธิ์ลุ้นโชค",
      status_label_active: "รอการจับรางวัล",
      status_label_won: "ได้รับรางวัล",
      ticket_number_label: "หมายเลขตั๋ว",
      ticket_type_label: "ตั๋ว",
    },
    fields: [
      { key: "empty_title", label: "หัวข้อ empty state", type: "text" },
      { key: "empty_text", label: "ข้อความ empty state", type: "textarea" },
      { key: "empty_cta_label", label: "ข้อความปุ่ม CTA", type: "text" },
      { key: "empty_cta_link", label: "ลิงก์ปุ่ม CTA", type: "text" },
      { key: "error_title", label: "หัวข้อ error state", type: "text" },
      { key: "error_text", label: "ข้อความ error state", type: "text" },
      { key: "retry_label", label: "ข้อความปุ่มลองใหม่", type: "text" },
      { key: "count_label", label: "ข้อความนับจำนวน (ใช้ {n} แทนจำนวน)", type: "text" },
      { key: "status_label_active", label: "ข้อความสถานะ active", type: "text" },
      { key: "status_label_won", label: "ข้อความสถานะ won", type: "text" },
      { key: "ticket_number_label", label: "ข้อความ \"หมายเลขตั๋ว\"", type: "text" },
      { key: "ticket_type_label", label: "Badge ประเภทตั๋ว", type: "text" },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Section Categories (UI grouping for Add Section modal)             */
/* ------------------------------------------------------------------ */

interface SectionCategory {
  id: string;
  label: string;
  icon: string;
  types: string[];
}

const sectionCategories: SectionCategory[] = [
  {
    id: "banners",
    label: "Banners & Hero",
    icon: "🖼️",
    types: [
      "hero_banner",
      "banner_carousel",
      "promo_banner",
      "home_news_banner_carousel",
    ],
  },
  {
    id: "headers_layout",
    label: "Headers & Layout",
    icon: "📐",
    types: ["section_header", "home_section_heading", "rich_text", "spacer"],
  },
  {
    id: "menus_nav",
    label: "Menus & Navigation",
    icon: "🧭",
    types: [
      "feature_menu",
      "feature_list",
      "profile_menu_group",
      "history_tabs_nav",
    ],
  },
  {
    id: "points_wallet",
    label: "Points & Wallet",
    icon: "💰",
    types: [
      "points_summary",
      "profile_points_card",
      "profile_tier_progress",
      "wallet_balance_cards",
      "wallet_transaction_list",
    ],
  },
  {
    id: "profile_account",
    label: "Profile & Account",
    icon: "👤",
    types: [
      "profile_header_card",
      "profile_warning_alert",
      "profile_logout_button",
    ],
  },
  {
    id: "rewards_shop_missions",
    label: "Rewards, Shop & Missions",
    icon: "🎁",
    types: [
      "home_rewards_tabs",
      "home_lucky_draw_list",
      "rewards_tabs_grid",
      "rewards_history_cta",
      "shop_links_list",
      "missions_tabs_list",
    ],
  },
  {
    id: "lists_feeds",
    label: "Lists & Feeds",
    icon: "📋",
    types: [
      "history_stat_summary",
      "history_scan_list",
      "history_redeems_list",
      "history_coupons_list",
      "history_lucky_draw_list",
      "recent_news",
      "news_list",
      "notifications_list",
      "support_faq_list",
    ],
  },
  {
    id: "support_settings",
    label: "Support & Settings",
    icon: "⚙️",
    types: [
      "support_contact_cta",
      "settings_notifications_group",
      "settings_delete_account_card",
      "settings_app_version_footer",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Sortable Section Card                                              */
/* ------------------------------------------------------------------ */

function SortableSectionCard({
  section,
  isActive,
  onSelect,
  onToggleVisible,
  onRemove,
}: {
  section: Section;
  isActive: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = sectionTypes[section.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-[var(--md-radius-sm)] border transition-all cursor-pointer ${
        isActive
          ? "border-[var(--md-primary)] bg-[var(--md-primary-light)]/10"
          : "border-[var(--md-outline-variant)] bg-[var(--md-surface)] hover:bg-[var(--md-surface-container)]"
      } ${!section.visible ? "opacity-50" : ""}`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)] touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      <span className="text-lg">{meta?.icon || "📦"}</span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--md-on-surface)] truncate">
          {meta?.label || section.type}
        </p>
        <p className="text-[11px] text-[var(--md-on-surface-variant)] truncate">
          {meta?.description || ""}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
        className="text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
        title={section.visible ? "ซ่อน" : "แสดง"}
      >
        {section.visible ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
          </svg>
        )}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-[var(--md-error)] hover:text-[var(--md-error)]/80"
        title="ลบ"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Properties Editor                                          */
/* ------------------------------------------------------------------ */

function SectionEditor({
  section,
  onChange,
}: {
  section: Section;
  onChange: (updated: Section) => void;
}) {
  const typeDef = sectionTypes[section.type];
  if (!typeDef) return <p className="text-sm text-[var(--md-on-surface-variant)]">Unknown section type</p>;

  const updateProp = (key: string, value: unknown) => {
    onChange({ ...section, props: { ...section.props, [key]: value } });
  };

  const fieldClass =
    "w-full h-[40px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";

  const textareaClass =
    "w-full min-h-[80px] px-3 py-2 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none resize-y focus:border-[var(--md-primary)] focus:border-2 transition-all";

  const renderField = (field: FieldDef) => {
    const value = section.props[field.key];

    if (field.type === "items") {
      const items = (value as Record<string, unknown>[]) || [];
      return (
        <div key={field.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px]">
              {field.label}
            </label>
            <button
              onClick={() => {
                const newItem: Record<string, unknown> = {};
                field.itemFields?.forEach((f) => (newItem[f.key] = ""));
                updateProp(field.key, [...items, newItem]);
              }}
              className="text-[12px] text-[var(--md-primary)] font-medium hover:underline"
            >
              + เพิ่ม
            </button>
          </div>
          {items.map((item, idx) => (
            <div
              key={idx}
              className="border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] p-3 space-y-2 relative"
            >
              <button
                onClick={() => {
                  const updated = items.filter((_, i) => i !== idx);
                  updateProp(field.key, updated);
                }}
                className="absolute top-2 right-2 text-[var(--md-error)] text-xs"
              >
                ✕
              </button>
              {field.itemFields?.map((subField) => (
                <div key={subField.key}>
                  <label className="text-[11px] text-[var(--md-on-surface-variant)] mb-1 block">
                    {subField.label}
                  </label>
                  {subField.type === "select" ? (
                    <select
                      value={(item[subField.key] as string) || ""}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], [subField.key]: e.target.value };
                        updateProp(field.key, updated);
                      }}
                      className={fieldClass}
                    >
                      <option value="">-- เลือก --</option>
                      {subField.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : subField.type === "image" ? (
                    <ImageUpload
                      value={(item[subField.key] as string) ?? ""}
                      onChange={(url) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], [subField.key]: url };
                        updateProp(field.key, updated);
                      }}
                      label=""
                      compact
                    />
                  ) : (
                    <input
                      type={subField.type === "number" ? "number" : "text"}
                      value={(item[subField.key] as string) ?? ""}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], [subField.key]: e.target.value };
                        updateProp(field.key, updated);
                      }}
                      className={fieldClass}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label className="text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 block uppercase tracking-[0.4px]">
          {field.label}
        </label>
        {field.type === "boolean" ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateProp(field.key, e.target.checked)}
              className="w-4 h-4 accent-[var(--md-primary)]"
            />
            <span className="text-[13px] text-[var(--md-on-surface)]">
              {value ? "เปิด" : "ปิด"}
            </span>
          </label>
        ) : field.type === "textarea" ? (
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => updateProp(field.key, e.target.value)}
            className={textareaClass}
          />
        ) : field.type === "select" ? (
          <select
            value={(value as string) ?? ""}
            onChange={(e) => updateProp(field.key, e.target.value)}
            className={fieldClass}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === "number" ? (
          <input
            type="number"
            value={(value as number) ?? 0}
            onChange={(e) => updateProp(field.key, Number(e.target.value))}
            className={fieldClass}
          />
        ) : field.type === "image" ? (
          <ImageUpload
            value={(value as string) ?? ""}
            onChange={(url) => updateProp(field.key, url)}
            label=""
            compact
          />
        ) : (
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => updateProp(field.key, e.target.value)}
            className={fieldClass}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--md-outline-variant)]">
        <span className="text-xl">{typeDef.icon}</span>
        <div>
          <p className="text-[14px] font-medium text-[var(--md-on-surface)]">
            {typeDef.label}
          </p>
          <p className="text-[11px] text-[var(--md-on-surface-variant)]">
            {typeDef.description}
          </p>
        </div>
      </div>
      {typeDef.fields.map(renderField)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Live Preview Panel                                                 */
/* ------------------------------------------------------------------ */

const CONSUMER_URL =
  process.env.NEXT_PUBLIC_CONSUMER_URL || "http://localhost:30403";

function LivePreviewPanel({
  pageSlug,
  refreshKey,
}: {
  pageSlug: string;
  refreshKey: number;
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [manualKey, setManualKey] = useState(0);
  const [visible, setVisible] = useState(true);

  // Map slug → consumer URL path. "home" lives at "/" not "/home".
  const path = pageSlug === "home" ? "" : pageSlug;
  const src = `${CONSUMER_URL}/${path}?_pb=${refreshKey}_${manualKey}`;

  if (!visible) {
    return (
      <div className="xl:w-[60px] flex-shrink-0">
        <button
          onClick={() => setVisible(true)}
          className="w-full h-[40px] bg-[var(--md-surface)] md-elevation-1 rounded-[var(--md-radius-sm)] text-[11px] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)]"
          title="แสดง Live Preview"
        >
          👁️
        </button>
      </div>
    );
  }

  const frameWidth = device === "mobile" ? "w-[390px]" : "w-full";
  const frameHeight = "h-[780px]";

  return (
    <div className="xl:w-[420px] flex-shrink-0">
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-4 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-medium text-[var(--md-on-surface)]">
            Live Preview
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDevice(device === "mobile" ? "desktop" : "mobile")}
              className="h-[28px] px-2 text-[11px] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] rounded-[var(--md-radius-sm)]"
              title="เปลี่ยนขนาด"
            >
              {device === "mobile" ? "📱" : "💻"}
            </button>
            <button
              onClick={() => setManualKey((k) => k + 1)}
              className="h-[28px] px-2 text-[11px] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] rounded-[var(--md-radius-sm)]"
              title="รีเฟรช"
            >
              🔄
            </button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="h-[28px] px-2 text-[11px] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] rounded-[var(--md-radius-sm)] flex items-center"
              title="เปิดในแท็บใหม่"
            >
              🔗
            </a>
            <button
              onClick={() => setVisible(false)}
              className="h-[28px] px-2 text-[11px] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] rounded-[var(--md-radius-sm)]"
              title="ซ่อน"
            >
              ✕
            </button>
          </div>
        </div>

        <p className="text-[10px] text-[var(--md-on-surface-variant)] mb-2">
          <span className="font-mono">{CONSUMER_URL}/{pageSlug}</span>
        </p>

        <div className="flex justify-center overflow-hidden">
          <div
            className={`${frameWidth} ${frameHeight} rounded-[24px] border-[6px] border-gray-800 bg-white shadow-inner overflow-hidden`}
            style={{ maxWidth: "100%" }}
          >
            <iframe
              key={`${refreshKey}-${manualKey}`}
              src={src}
              className="w-full h-full border-0"
              title={`preview-${pageSlug}`}
            />
          </div>
        </div>

        <p className="text-[10px] text-[var(--md-on-surface-variant)] mt-2 text-center">
          Preview reload อัตโนมัติหลัง auto-save (≈1.5s)
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Section Modal                                                  */
/* ------------------------------------------------------------------ */

// Per-category visual tint (subtle background + border on cards)
const CATEGORY_TINT: Record<string, { bg: string; border: string; ring: string }> = {
  banners:               { bg: "bg-sky-50/60",     border: "border-sky-100",     ring: "hover:ring-sky-300" },
  headers_layout:        { bg: "bg-slate-50/60",   border: "border-slate-100",   ring: "hover:ring-slate-300" },
  menus_nav:             { bg: "bg-indigo-50/60",  border: "border-indigo-100",  ring: "hover:ring-indigo-300" },
  points_wallet:         { bg: "bg-amber-50/60",   border: "border-amber-100",   ring: "hover:ring-amber-300" },
  profile_account:       { bg: "bg-violet-50/60",  border: "border-violet-100",  ring: "hover:ring-violet-300" },
  rewards_shop_missions: { bg: "bg-orange-50/60",  border: "border-orange-100",  ring: "hover:ring-orange-300" },
  lists_feeds:           { bg: "bg-emerald-50/60", border: "border-emerald-100", ring: "hover:ring-emerald-300" },
  support_settings:      { bg: "bg-zinc-50/60",    border: "border-zinc-100",    ring: "hover:ring-zinc-300" },
  __other:               { bg: "bg-gray-50/60",    border: "border-gray-100",    ring: "hover:ring-gray-300" },
};

function AddSectionModal({
  open,
  onAdd,
  onClose,
}: {
  open: boolean;
  onAdd: (type: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  // Reset search whenever the modal opens fresh
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  if (!open) return null;

  const query = search.trim().toLowerCase();
  const matches = (type: string): boolean => {
    if (!query) return true;
    const meta = sectionTypes[type];
    if (!meta) return false;
    return (
      type.toLowerCase().includes(query) ||
      meta.label.toLowerCase().includes(query) ||
      (meta.description || "").toLowerCase().includes(query)
    );
  };

  // Build list of categories whose name itself matches the query (so we can keep all their items)
  const categoryNameMatches = (catLabel: string) =>
    !!query && catLabel.toLowerCase().includes(query);

  const categorized = new Set(sectionCategories.flatMap((c) => c.types));
  const uncategorized = Object.keys(sectionTypes).filter(
    (t) => !categorized.has(t),
  );

  // Compute filtered groups
  const filteredGroups = sectionCategories
    .map((cat) => {
      const items = cat.types
        .filter((t) => sectionTypes[t])
        .filter((t) => (categoryNameMatches(cat.label) ? true : matches(t)));
      return { cat, items };
    })
    .filter((g) => g.items.length > 0);

  const filteredOther = uncategorized.filter((t) => matches(t));
  const totalFound =
    filteredGroups.reduce((s, g) => s + g.items.length, 0) + filteredOther.length;

  const renderCard = (type: string, tintKey: string) => {
    const meta = sectionTypes[type];
    if (!meta) return null;
    const tint = CATEGORY_TINT[tintKey] || CATEGORY_TINT.__other;
    return (
      <button
        key={type}
        onClick={() => {
          onAdd(type);
          onClose();
        }}
        className={`group flex items-start gap-3 p-3.5 h-[88px] rounded-xl border ${tint.border} ${tint.bg} hover:shadow-md hover:-translate-y-0.5 hover:ring-2 ${tint.ring} transition-all text-left`}
      >
        <span className="text-2xl shrink-0 leading-none mt-0.5 group-hover:scale-110 transition-transform">
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--md-on-surface)] truncate">
            {meta.label}
          </p>
          <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5 line-clamp-2 leading-snug">
            {meta.description}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--md-surface)] rounded-2xl md-elevation-3 w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--md-outline-variant)]">
          <div>
            <h3 className="text-[18px] font-semibold text-[var(--md-on-surface)]">
              เพิ่ม Section
            </h3>
            <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">
              เลือก section ที่ต้องการเพิ่มในหน้านี้
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-[var(--md-surface-container)] flex items-center justify-center text-[var(--md-on-surface-variant)] transition-colors"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-[var(--md-outline-variant)] bg-[var(--md-surface)]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)] text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา section... (ชื่อ / คำอธิบาย / หมวด)"
              className="w-full pl-9 pr-9 py-2.5 text-[13px] rounded-lg border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)] focus:outline-none focus:ring-2 focus:ring-[var(--md-primary)]/40 focus:border-[var(--md-primary)] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-[var(--md-surface-container)] flex items-center justify-center text-[var(--md-on-surface-variant)] text-xs"
                aria-label="ล้างการค้นหา"
              >
                ✕
              </button>
            )}
          </div>
          {query && (
            <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-2 px-1">
              พบ <span className="font-semibold text-[var(--md-on-surface)]">{totalFound}</span> รายการ
            </p>
          )}
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1">
          {totalFound === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-[14px] font-medium text-[var(--md-on-surface)]">
                ไม่พบ section ที่ตรงกับ &quot;{search}&quot;
              </p>
              <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">
                ลองค้นหาด้วยคำอื่น หรือล้างการค้นหา
              </p>
              <button
                onClick={() => setSearch("")}
                className="mt-4 px-4 py-2 text-[12px] rounded-lg bg-[var(--md-primary)] text-white hover:opacity-90 transition-opacity"
              >
                ล้างการค้นหา
              </button>
            </div>
          ) : (
            <>
              {filteredGroups.map(({ cat, items }) => (
                <div key={cat.id}>
                  <div className="sticky top-0 z-10 bg-[var(--md-surface)]/95 backdrop-blur-sm border-b border-[var(--md-outline-variant)] px-5 py-2.5 flex items-center gap-2 shadow-sm">
                    <span className="text-base leading-none">{cat.icon}</span>
                    <span className="text-[11px] font-bold text-[var(--md-on-surface)] uppercase tracking-wider">
                      {cat.label}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] px-2 py-0.5 rounded-full ml-auto">
                      {items.length}
                    </span>
                  </div>
                  <div className="px-5 py-4 grid grid-cols-2 gap-3">
                    {items.map((t) => renderCard(t, cat.id))}
                  </div>
                </div>
              ))}
              {filteredOther.length > 0 && (
                <div>
                  <div className="sticky top-0 z-10 bg-[var(--md-surface)]/95 backdrop-blur-sm border-b border-[var(--md-outline-variant)] px-5 py-2.5 flex items-center gap-2 shadow-sm">
                    <span className="text-base leading-none">📦</span>
                    <span className="text-[11px] font-bold text-[var(--md-on-surface)] uppercase tracking-wider">
                      Other
                    </span>
                    <span className="text-[10px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] px-2 py-0.5 rounded-full ml-auto">
                      {filteredOther.length}
                    </span>
                  </div>
                  <div className="px-5 py-4 grid grid-cols-2 gap-3">
                    {filteredOther.map((t) => renderCard(t, "__other"))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PageBuilderPage() {
  const [pageSlug, setPageSlug] = useState("home");
  const [sections, setSections] = useState<Section[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [version, setVersion] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<{ version: number; status: string; updated_at: string }[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [dupTarget, setDupTarget] = useState("");
  const [customPages, setCustomPages] = useState<{ value: string; label: string }[]>([]);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});

  const allPages = [...BUILT_IN_PAGES, ...customPages];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const fetchCustomPages = useCallback(async () => {
    try {
      const data = await api.get<{ data: PageConfig[] }>("/api/v1/page-configs");
      const customs = (data.data || [])
        .filter((pc) => !BUILT_IN_SLUGS.has(pc.page_slug))
        .map((pc) => ({ value: pc.page_slug, label: `📄 ${pc.page_slug}` }));
      setCustomPages(customs);
    } catch { /* ignore */ }
  }, []);

  const fetchConfig = useCallback(async (slug: string) => {
    setLoading(true);
    setActiveId(null);
    setDirty(false);
    try {
      const data = await api.get<PageConfig>(`/api/v1/page-configs/${slug}`);
      setSections(data.sections || []);
      setStatus((data.status as "draft" | "published") || "published");
      setVersion(data.version || 0);
    } catch {
      setSections([]);
      setStatus("published");
      setVersion(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomPages();
  }, [fetchCustomPages]);

  useEffect(() => {
    fetchConfig(pageSlug);
    setPreviewKey((k) => k + 1);
  }, [pageSlug, fetchConfig]);

  const handleCreatePage = async () => {
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (!slug) return;
    if (BUILT_IN_SLUGS.has(slug) || customPages.some((p) => p.value === slug)) {
      toast.error("ชื่อหน้านี้มีอยู่แล้ว");
      return;
    }
    try {
      await api.put("/api/v1/page-configs", {
        page_slug: slug,
        sections: [],
        status: "draft",
      });
      setCustomPages((prev) => [...prev, { value: slug, label: `📄 ${newLabel || slug}` }]);
      setNewSlug("");
      setNewLabel("");
      setShowNewPage(false);
      setPageSlug(slug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้างหน้าไม่สำเร็จ");
    }
  };

  const handleDeletePage = async (slug: string) => {
    if (BUILT_IN_SLUGS.has(slug)) return;
    if (!confirm(`ลบหน้า "${slug}" ถาวร?`)) return;
    try {
      await api.delete(`/api/v1/page-configs/${slug}`);
      setCustomPages((prev) => prev.filter((p) => p.value !== slug));
      if (pageSlug === slug) setPageSlug("home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  };

  const fetchVersions = async (slug: string) => {
    setLoadingVersions(true);
    try {
      const data = await api.get<{ data: typeof versions }>(`/api/v1/page-configs/${slug}/versions`);
      setVersions(data.data || []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const restoreVersion = async (ver: number) => {
    if (!confirm(`Restore version ${ver}?`)) return;
    try {
      const result = await api.post<PageConfig>(`/api/v1/page-configs/${pageSlug}/restore`, { version: ver });
      setSections(result.sections || []);
      setVersion(result.version || 0);
      setShowHistory(false);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    }
  };

  const handleDuplicate = async () => {
    if (!dupTarget) return;
    try {
      await api.post("/api/v1/page-configs/duplicate", {
        from_slug: pageSlug,
        to_slug: dupTarget,
      });
      toast.success(`Duplicated to "${dupTarget}" (as draft)`);
      setShowDuplicate(false);
      setDupTarget("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const handleSave = async (silent = false) => {
    if (silent) {
      setAutoSaving(true);
    } else {
      setSaving(true);
    }
    setSaved(false);
    try {
      const ordered = sections.map((s, i) => ({ ...s, order: i + 1 }));
      const result = await api.put<PageConfig>("/api/v1/page-configs", {
        page_slug: pageSlug,
        sections: ordered,
        status,
      });
      setVersion(result.version || version + 1);
      setSaved(true);
      setDirty(false);
      setPreviewKey((k) => k + 1);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    } finally {
      if (silent) {
        setAutoSaving(false);
      } else {
        setSaving(false);
      }
    }
  };

  // keep latest handleSave in ref so auto-save effect can call it without re-running
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  // Debounced auto-save: ทุกครั้งที่ dirty รอ 1.5s แล้ว save อัตโนมัติ
  useEffect(() => {
    if (!dirty || saving || autoSaving || loading) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRef.current(true);
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [dirty, saving, autoSaving, loading, sections, status, pageSlug]);

  // Cancel pending auto-save when switching pages
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, [pageSlug]);

  const updateSections = (fn: (prev: Section[]) => Section[]) => {
    setSections((prev) => {
      const next = fn(prev);
      setDirty(true);
      return next;
    });
  };

  const addSection = (type: string) => {
    const typeDef = sectionTypes[type];
    if (!typeDef) return;
    const newSection: Section = {
      id: `${type}-${Date.now()}`,
      type,
      order: sections.length + 1,
      visible: true,
      props: { ...typeDef.defaultProps },
    };
    updateSections((prev) => [...prev, newSection]);
    setActiveId(newSection.id);
  };

  const removeSection = (id: string) => {
    updateSections((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const toggleVisible = (id: string) => {
    updateSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)),
    );
  };

  const updateSection = (updated: Section) => {
    updateSections((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const activeSection = sections.find((s) => s.id === activeId);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Page Builder
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            จัดการ layout ของ Consumer Frontend
          </p>
        </div>
        <div className="flex items-center gap-3">
          {autoSaving ? (
            <span className="text-[12px] text-[var(--md-primary)] font-medium flex items-center gap-1">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              กำลังบันทึกอัตโนมัติ...
            </span>
          ) : dirty ? (
            <span className="text-[12px] text-[var(--md-warning)] font-medium">
              ● กำลังบันทึกอัตโนมัติ...
            </span>
          ) : saved ? (
            <span className="text-[12px] text-[var(--md-success)] font-medium">
              ✓ บันทึกอัตโนมัติแล้ว
            </span>
          ) : null}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "draft" | "published");
              setDirty(true);
            }}
            className="h-[40px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] text-[var(--md-on-surface)] bg-transparent"
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Page Selector — top-level (hides nested sub-pages) */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {allPages
          .filter((p) => !("parent" in p) || !p.parent)
          .map((p) => {
            // Highlight parent when a child of it is currently selected
            const currentChild = BUILT_IN_PAGES.find(
              (bp) => bp.value === pageSlug && bp.parent,
            );
            const isActive =
              pageSlug === p.value ||
              (currentChild && currentChild.parent === p.value);
            return (
              <div key={p.value} className="relative group">
                <button
                  onClick={() => setPageSlug(p.value)}
                  className={`h-[36px] px-4 rounded-[var(--md-radius-sm)] text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-[var(--md-primary)] text-white"
                      : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]"
                  }`}
                >
                  {p.label}
                </button>
                {!BUILT_IN_SLUGS.has(p.value) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePage(p.value);
                    }}
                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--md-error)] text-white text-[10px] leading-none"
                    title="ลบหน้านี้"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

        <button
          onClick={() => setShowNewPage(true)}
          className="h-[36px] px-3 rounded-[var(--md-radius-sm)] text-[13px] font-medium border-2 border-dashed border-[var(--md-outline)] text-[var(--md-on-surface-variant)] hover:border-[var(--md-primary)] hover:text-[var(--md-primary)] transition-all"
        >
          + สร้างหน้าใหม่
        </button>
      </div>

      {/* Sub-page tabs — shown only when a parent page (with children) is active */}
      {(() => {
        // Figure out the parent slug for the current context
        const currentChild = BUILT_IN_PAGES.find(
          (p) => p.value === pageSlug && p.parent,
        );
        const parentSlug = currentChild ? currentChild.parent! : pageSlug;
        const children = BUILT_IN_PAGES.filter((p) => p.parent === parentSlug);
        if (children.length === 0) return null;
        return (
          <div className="flex gap-2 mb-6 flex-wrap items-center pl-4 border-l-2 border-[var(--md-outline-variant)]">
            <span className="text-[11px] text-[var(--md-on-surface-variant)] mr-1">
              หน้าย่อย:
            </span>
            <button
              onClick={() => setPageSlug(parentSlug)}
              className={`h-[30px] px-3 rounded-full text-[12px] font-medium transition-all ${
                pageSlug === parentSlug
                  ? "bg-[var(--md-primary)] text-white"
                  : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]"
              }`}
            >
              หลัก
            </button>
            {children.map((c) => (
              <button
                key={c.value}
                onClick={() => setPageSlug(c.value)}
                className={`h-[30px] px-3 rounded-full text-[12px] font-medium transition-all ${
                  pageSlug === c.value
                    ? "bg-[var(--md-primary)] text-white"
                    : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* New Page Modal */}
      {showNewPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-3 w-full max-w-[420px] p-6">
            <h3 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">
              สร้างหน้าใหม่
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1 block">
                  Slug (ภาษาอังกฤษ, ใช้ใน URL)
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="เช่น promotions, about-us, faq"
                  className="w-full h-[40px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2"
                />
                {newSlug && (
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">
                    URL: <span className="font-mono text-[var(--md-primary)]">/p/{newSlug.replace(/[^a-z0-9-]/g, "-")}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px] mb-1 block">
                  ชื่อแสดงผล (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="เช่น โปรโมชั่น, เกี่ยวกับเรา"
                  className="w-full h-[40px] px-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[13px] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowNewPage(false); setNewSlug(""); setNewLabel(""); }}
                className="h-[36px] px-4 text-[13px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreatePage}
                disabled={!newSlug.trim()}
                className="h-[36px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-sm)] text-[13px] font-medium disabled:opacity-50"
              >
                สร้างหน้า
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-6 h-6 text-[var(--md-primary)]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left: Section List */}
          <div className="xl:w-[360px] flex-shrink-0">
            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-medium text-[var(--md-on-surface)]">
                  Sections ({sections.length})
                </h2>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="h-[32px] px-3 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-sm)] text-[12px] font-medium hover:bg-[var(--md-primary-dark)] transition-all flex items-center gap-1"
                >
                  + เพิ่ม
                </button>
              </div>

              {sections.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[14px] text-[var(--md-on-surface-variant)]">
                    ยังไม่มี section
                  </p>
                  <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">
                    กด &quot;+ เพิ่ม&quot; เพื่อเริ่มสร้าง layout
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {sections.map((section) => (
                        <SortableSectionCard
                          key={section.id}
                          section={section}
                          isActive={activeId === section.id}
                          onSelect={() => setActiveId(section.id)}
                          onToggleVisible={() => toggleVisible(section.id)}
                          onRemove={() => removeSection(section.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowHistory(!showHistory);
                      if (!showHistory) fetchVersions(pageSlug);
                    }}
                    className="h-[28px] px-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] transition-all"
                  >
                    History
                  </button>
                  <button
                    onClick={() => setShowDuplicate(!showDuplicate)}
                    className="h-[28px] px-2.5 text-[11px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] transition-all"
                  >
                    Duplicate
                  </button>
                </div>
                {version > 0 && (
                  <span className="text-[11px] text-[var(--md-on-surface-variant)]">
                    v{version}
                  </span>
                )}
              </div>

              {/* Version History Panel */}
              {showHistory && (
                <div className="mt-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] p-3">
                  <p className="text-[12px] font-medium text-[var(--md-on-surface)] mb-2">
                    Version History
                  </p>
                  {loadingVersions ? (
                    <p className="text-[11px] text-[var(--md-on-surface-variant)]">Loading...</p>
                  ) : versions.length === 0 ? (
                    <p className="text-[11px] text-[var(--md-on-surface-variant)]">No history yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {versions.map((v) => (
                        <div
                          key={v.version}
                          className="flex items-center justify-between p-2 rounded bg-[var(--md-surface-container)] text-[11px]"
                        >
                          <div>
                            <span className="font-medium text-[var(--md-on-surface)]">
                              v{v.version}
                            </span>
                            <span className="ml-2 text-[var(--md-on-surface-variant)]">
                              {v.status}
                            </span>
                          </div>
                          <button
                            onClick={() => restoreVersion(v.version)}
                            className="text-[var(--md-primary)] font-medium hover:underline"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate Panel */}
              {showDuplicate && (
                <div className="mt-3 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] p-3">
                  <p className="text-[12px] font-medium text-[var(--md-on-surface)] mb-2">
                    Duplicate layout to another page
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={dupTarget}
                      onChange={(e) => setDupTarget(e.target.value)}
                      className="flex-1 h-[32px] px-2 text-[12px] border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] bg-transparent"
                    >
                      <option value="">-- เลือกหน้า --</option>
                      {allPages.filter((p) => p.value !== pageSlug).map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleDuplicate}
                      disabled={!dupTarget}
                      className="h-[32px] px-3 bg-[var(--md-primary)] text-white text-[11px] font-medium rounded-[var(--md-radius-sm)] disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle: Section Editor */}
          <div className="flex-1 min-w-0">
            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-5 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {activeSection ? (
                <SectionEditor
                  section={activeSection}
                  onChange={updateSection}
                />
              ) : (
                <div className="text-center py-16">
                  <svg viewBox="0 0 24 24" fill="var(--md-on-surface-variant)" className="w-12 h-12 mx-auto mb-3 opacity-40">
                    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
                  </svg>
                  <p className="text-[14px] text-[var(--md-on-surface-variant)]">
                    เลือก section เพื่อแก้ไข
                  </p>
                  <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">
                    หรือกด &quot;+ เพิ่ม&quot; เพื่อสร้าง section ใหม่
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Preview */}
          <LivePreviewPanel pageSlug={pageSlug} refreshKey={previewKey} />
        </div>
      )}

      {/* Add Section Modal */}
      <AddSectionModal
        open={showAddModal}
        onAdd={addSection}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
