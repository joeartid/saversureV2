"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, getUser } from "@/lib/auth";
import { useTenantContext } from "@/lib/tenant-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "หน้าหลัก",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M13 3v6h8V3m-8 18h8V11h-8M3 21h8v-6H3m0-2h8V3H3v10z" />
          </svg>
        ),
      },
      {
        href: "/ops-center",
        label: "Ops Center",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "แคมเปญ & QR",
    items: [
      {
        href: "/campaigns",
        label: "Campaigns",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 3V6L5 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
          </svg>
        ),
      },
      {
        href: "/products",
        label: "Products",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M18.36 9l.6 3H5.04l.6-3h12.72M20 4H4v2h16V4zm0 3H4l-1 5v2h1v6h10v-6h4v6h2v-6h1v-2l-1-5zM6 18v-4h6v4H6z" />
          </svg>
        ),
      },
      {
        href: "/batches",
        label: "Batches",
        roles: ["super_admin", "brand_admin", "factory_user"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
          </svg>
        ),
      },
      {
        href: "/rolls",
        label: "Rolls",
        roles: ["super_admin", "brand_admin", "factory_user"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
          </svg>
        ),
      },
      {
        href: "/factories",
        label: "Factories",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
          </svg>
        ),
      },
      {
        href: "/promotions",
        label: "Promotions",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
          </svg>
        ),
      },
      {
        href: "/qc",
        label: "QC Verify",
        roles: ["super_admin", "brand_admin", "factory_user"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "ลูกค้า & ธุรกรรม",
    items: [
      {
        href: "/customers",
        label: "Customers",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
        ),
      },
      {
        href: "/scan-history",
        label: "Scan History",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
          </svg>
        ),
      },
      {
        href: "/transactions",
        label: "Transactions",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "รางวัล & แต้ม",
    items: [
      {
        href: "/rewards",
        label: "Rewards",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
          </svg>
        ),
      },
      {
        href: "/tiers",
        label: "Reward Tiers",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
          </svg>
        ),
      },
      {
        href: "/currencies",
        label: "Point Currencies",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c-.02 1.78-1.35 2.83-3.12 3.19z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "แคมเปญเสริม",
    items: [
      {
        href: "/news",
        label: "News & Banners",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        ),
      },
      {
        href: "/lucky-draw",
        label: "Lucky Draw",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h18v8zM6 15h2.5v-2.5H11v-2H8.5V8.5H6V11H3v2h3zM18 15h1.5v-1.5H21v-2h-1.5V10H18v1.5h-1.5V13H18z" />
          </svg>
        ),
      },
      {
        href: "/donations",
        label: "Donations",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        ),
      },
      {
        href: "/gamification",
        label: "Gamification",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "สนับสนุน",
    items: [
      {
        href: "/support",
        label: "Support",
        roles: ["super_admin", "brand_admin", "brand_staff"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M21 12.22C21 6.73 16.74 3 12 3c-4.69 0-9 3.65-9 9.28-.6.34-1 .98-1 1.72v2c0 1.1.9 2 2 2h1v-6.1c0-3.87 3.13-7 7-7s7 3.13 7 7V19h-8v2h8c1.1 0 2-.9 2-2v-1.22c.59-.31 1-.92 1-1.64v-2.3c0-.7-.41-1.31-1-1.62z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "อินทิเกรชัน",
    items: [
      {
        href: "/api-keys",
        label: "API Keys",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
          </svg>
        ),
      },
      {
        href: "/webhooks",
        label: "Webhooks",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "ตั้งค่า",
    items: [
      {
        href: "/branding",
        label: "Branding",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0 1 12 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 0 0-.14-.35c-.41-.46-.63-1.05-.63-1.65a2.5 2.5 0 0 1 2.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z" />
          </svg>
        ),
      },
      {
        href: "/settings/staff",
        label: "Staff",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        ),
      },
      {
        href: "/settings",
        label: "Settings",
        roles: ["super_admin", "brand_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "ระบบ",
    items: [
      {
        href: "/tenants",
        label: "Tenants",
        roles: ["super_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
          </svg>
        ),
      },
      {
        href: "/audit",
        label: "Audit Log",
        roles: ["super_admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
          </svg>
        ),
      },
    ],
  },
];

const STORAGE_KEY = "sidebar_collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { tenants, activeTenant, isSuperAdmin, switchTenant } = useTenantContext();

  useEffect(() => {
    setUser(getUser());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") setCollapsed(true);
    } catch { /* SSR safe */ }
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
  };

  const userRole = user?.role || "";
  const filterByRole = (item: NavItem) => {
    if (!item.roles) return true;
    if (!userRole) return false;
    return item.roles.includes(userRole);
  };

  return (
    <aside
      className={`
        ${collapsed ? "w-[72px]" : "w-[280px]"}
        bg-[var(--md-surface)] min-h-screen flex flex-col
        border-r border-[var(--md-outline-variant)]
        transition-all duration-300 ease-in-out flex-shrink-0
      `}
    >
      {/* Header */}
      <div className={`flex items-center ${collapsed ? "justify-center px-2" : "px-4"} pt-4 pb-3`}>
        <button
          onClick={toggleCollapse}
          className="w-10 h-10 flex items-center justify-center rounded-[var(--md-radius-md)] hover:bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] transition-colors flex-shrink-0"
          title={collapsed ? "ขยาย sidebar" : "ย่อ sidebar"}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
        {!collapsed && (
          <div className="ml-2 overflow-hidden">
            <h1 className="text-[16px] font-semibold text-[var(--md-on-surface)] leading-tight tracking-[-0.2px] whitespace-nowrap">
              Saversure
            </h1>
            <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5 whitespace-nowrap">Admin Panel v2.0</p>
          </div>
        )}
      </div>

      {/* Tenant Switcher (super_admin only) */}
      {isSuperAdmin && tenants.length > 0 && !collapsed && (
        <div className="px-3 pb-3">
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--md-radius-md)] border border-[var(--md-outline-variant)] hover:border-[var(--md-primary)] bg-[var(--md-surface-container)] transition-all duration-200"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: activeTenant ? "#4caf50" : "#9e9e9e" }}>
                {activeTenant?.shortcode?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-medium text-[var(--md-on-surface)] truncate">
                  {activeTenant?.name || "Select Brand"}
                </p>
                <p className="text-[10px] text-[var(--md-on-surface-variant)] truncate">
                  {activeTenant?.slug || ""}{activeTenant?.shortcode ? ` · ${activeTenant.shortcode}` : ""}
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 text-[var(--md-on-surface-variant)] transition-transform ${switcherOpen ? "rotate-180" : ""}`}>
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            {switcherOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[var(--md-surface)] rounded-[var(--md-radius-md)] md-elevation-3 border border-[var(--md-outline-variant)] max-h-[240px] overflow-y-auto">
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { switchTenant(t.id); setSwitcherOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--md-surface-container)] transition-colors first:rounded-t-[var(--md-radius-md)] last:rounded-b-[var(--md-radius-md)] ${t.id === activeTenant?.id ? "bg-[var(--md-primary-light)]" : ""}`}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: t.id === activeTenant?.id ? "var(--md-primary)" : "#78909c" }}>
                      {t.shortcode?.toUpperCase() || t.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--md-on-surface)] truncate">{t.name}</p>
                      <p className="text-[10px] text-[var(--md-on-surface-variant)]">{t.slug}{t.shortcode ? ` · ${t.shortcode}` : ""}</p>
                    </div>
                    {t.id === activeTenant?.id && (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--md-primary)] flex-shrink-0">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isSuperAdmin && tenants.length > 0 && collapsed && (
        <div className="px-2 pb-2">
          <div
            className="w-[48px] h-[48px] mx-auto rounded-[var(--md-radius-md)] flex items-center justify-center text-[12px] font-bold text-white cursor-pointer hover:ring-2 hover:ring-[var(--md-primary)] transition-all"
            style={{ backgroundColor: "#4caf50" }}
            title={activeTenant ? `${activeTenant.name} (${activeTenant.shortcode})` : "Select Brand"}
            onClick={() => { setCollapsed(false); setSwitcherOpen(true); }}
          >
            {activeTenant?.shortcode?.toUpperCase() || "?"}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 pb-2 overflow-y-auto overflow-x-hidden">
        <div className="space-y-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(filterByRole);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                {!collapsed && (
                  <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--md-on-surface-variant)]/70 whitespace-nowrap overflow-hidden">
                    {group.label}
                  </p>
                )}
                {collapsed && <div className="border-t border-[var(--md-outline-variant)] mx-2 my-1" />}
                <div className="space-y-[2px]">
                  {visibleItems.map((item) => {
                    const isActive =
                      item.href === "/settings"
                        ? pathname === "/settings"
                        : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`
                          flex items-center ${collapsed ? "justify-center" : "gap-3"} h-[40px] ${collapsed ? "px-0 mx-auto w-[48px]" : "px-3"}
                          rounded-[var(--md-radius-xl)]
                          text-[14px] font-medium transition-all duration-200
                          ${
                            isActive
                              ? "bg-[var(--md-primary-light)] text-[var(--md-primary)]"
                              : "text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)]"
                          }
                        `}
                      >
                        <span className={`flex-shrink-0 ${isActive ? "text-[var(--md-primary)]" : "text-[var(--md-on-surface-variant)]"}`}>
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <>
                            <span className="tracking-[0.1px] whitespace-nowrap overflow-hidden">{item.label}</span>
                            {isActive && (
                              <span className="ml-auto w-[6px] h-[6px] rounded-full bg-[var(--md-primary)] flex-shrink-0" />
                            )}
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className="px-2 pb-3">
        <div className="border-t border-[var(--md-outline-variant)] pt-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[var(--md-primary)] flex items-center justify-center" title={user?.role?.replace("_", " ") || "User"}>
                <span className="text-[13px] font-medium text-white">
                  {user?.role?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <button
                onClick={logout}
                title="Sign Out"
                className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--md-error)] hover:bg-[var(--md-error-light)] transition-all duration-200"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 rounded-full bg-[var(--md-primary)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[13px] font-medium text-white">
                    {user?.role?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--md-on-surface)] truncate capitalize">
                    {user?.role?.replace("_", " ") || "Unknown"}
                  </p>
                  <p className="text-[11px] text-[var(--md-on-surface-variant)] truncate">
                    {activeTenant?.name || user?.tenant_id?.slice(0, 8) || ""}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="
                  flex items-center gap-3 w-full h-[36px] px-3 mt-1
                  rounded-[var(--md-radius-xl)] text-[13px] font-medium
                  text-[var(--md-error)] hover:bg-[var(--md-error-light)]
                  transition-all duration-200
                "
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
