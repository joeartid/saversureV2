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

const BUILT_IN_PAGES = [
  { value: "home", label: "หน้าแรก (Home)" },
  { value: "scan", label: "หน้าสแกน (Scan)" },
  { value: "rewards", label: "หน้ารางวัล (Rewards)" },
  { value: "history", label: "หน้าประวัติ (History)" },
  { value: "profile", label: "หน้าโปรไฟล์ (Profile)" },
  { value: "news", label: "หน้าข่าวสาร (News)" },
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
  history_page_header: {
    label: "History Page Header",
    icon: "📜",
    description: "Header gradient ของหน้า /history",
    defaultProps: {
      title: "ประวัติการสะสมแต้ม",
      show_scan_count: true,
      gradient_from: "#3C9B4D",
      gradient_to: "#7DBD48",
    },
    fields: [
      { key: "title", label: "หัวข้อ", type: "text" },
      { key: "show_scan_count", label: "แสดงจำนวนสแกน", type: "boolean" },
      { key: "gradient_from", label: "สี gradient เริ่ม (hex)", type: "text" },
      { key: "gradient_to", label: "สี gradient จบ (hex)", type: "text" },
    ],
  },
  history_stat_summary: {
    label: "History Stat Summary",
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
    defaultProps: {},
    fields: [],
  },
  history_scan_list: {
    label: "History Scan List",
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
    label: "Home — News Banner",
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
    label: "Home — หัวข้อ Section",
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
};

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

function AddSectionModal({
  open,
  onAdd,
  onClose,
}: {
  open: boolean;
  onAdd: (type: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-3 w-full max-w-[520px] max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--md-outline-variant)]">
          <h3 className="text-[18px] font-medium text-[var(--md-on-surface)]">
            เพิ่ม Section
          </h3>
          <button onClick={onClose} className="text-[var(--md-on-surface-variant)]">
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[60vh] grid grid-cols-2 gap-3">
          {Object.entries(sectionTypes).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => {
                onAdd(type);
                onClose();
              }}
              className="flex items-start gap-3 p-4 rounded-[var(--md-radius-sm)] border border-[var(--md-outline-variant)] hover:bg-[var(--md-surface-container)] transition-all text-left"
            >
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <p className="text-[13px] font-medium text-[var(--md-on-surface)]">
                  {meta.label}
                </p>
                <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">
                  {meta.description}
                </p>
              </div>
            </button>
          ))}
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

      {/* Page Selector */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {allPages.map((p) => (
          <div key={p.value} className="relative group">
            <button
              onClick={() => setPageSlug(p.value)}
              className={`h-[36px] px-4 rounded-[var(--md-radius-sm)] text-[13px] font-medium transition-all ${
                pageSlug === p.value
                  ? "bg-[var(--md-primary)] text-white"
                  : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]"
              }`}
            >
              {p.label}
            </button>
            {!BUILT_IN_SLUGS.has(p.value) && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeletePage(p.value); }}
                className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--md-error)] text-white text-[10px] leading-none"
                title="ลบหน้านี้"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => setShowNewPage(true)}
          className="h-[36px] px-3 rounded-[var(--md-radius-sm)] text-[13px] font-medium border-2 border-dashed border-[var(--md-outline)] text-[var(--md-on-surface-variant)] hover:border-[var(--md-primary)] hover:text-[var(--md-primary)] transition-all"
        >
          + สร้างหน้าใหม่
        </button>
      </div>

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
