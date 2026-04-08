"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, logout } from "@/lib/auth";
import { api } from "@/lib/api";
import { type MultiBalance, getPrimaryBalance, getDiamondBalance } from "@/lib/currency";
import { useTenant } from "./TenantProvider";

interface DrawerMenuItem {
  icon: string;
  label: string;
  link: string;
  visible?: boolean;
  group?: string;
}

// Icon registry — string name → SVG node. Reuses paths from menu-editor admin
// so admin's icon picker stays in sync with consumer rendering.
const DRAWER_ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
};

const DEFAULT_DRAWER_ITEMS: DrawerMenuItem[] = [
  { icon: "home", label: "หน้าแรก", link: "/", visible: true, group: "บริการส่วนตัว" },
  { icon: "user", label: "บัญชีของฉัน", link: "/profile", visible: true, group: "บริการส่วนตัว" },
  { icon: "history", label: "ประวัติกิจกรรมทั้งหมด", link: "/history", visible: true, group: "บริการส่วนตัว" },
  { icon: "tag", label: "คูปองของฉัน", link: "/history/coupons", visible: true, group: "บริการส่วนตัว" },
  { icon: "support", label: "ศูนย์ช่วยเหลือและคำถาม (FAQ)", link: "/support", visible: true, group: "ช่วยเหลือและการตั้งค่า" },
  { icon: "settings", label: "ตั้งค่าระบบ", link: "/settings", visible: true, group: "ช่วยเหลือและการตั้งค่า" },
  { icon: "mail", label: "ติดต่อแอดมิน", link: "/support/ticket", visible: true, group: "ช่วยเหลือและการตั้งค่า" },
];

interface ProfileData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  profile_picture?: string;
  avatar?: string;
}

interface Tier {
  id: string;
  name: string;
  icon: string;
  color: string;
  min_points: number;
}

interface TierResponse {
  tier: Tier | null;
}

export default function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [balances, setBalances] = useState<MultiBalance[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [menuItems, setMenuItems] = useState<DrawerMenuItem[]>(DEFAULT_DRAWER_ITEMS);
  const { brandName, branding } = useTenant();
  const primaryBalance = getPrimaryBalance(balances);
  const diamondBalance = getDiamondBalance(balances);

  // Fetch menu config once on mount (independent of open/close)
  useEffect(() => {
    api.get<{ items: DrawerMenuItem[] }>("/api/v1/public/nav-menu/drawer")
      .then((d) => {
        if (d.items && d.items.length > 0) {
          setMenuItems(d.items);
        }
      })
      .catch(() => {
        // network fail → keep DEFAULT_DRAWER_ITEMS
      });
  }, []);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (li) {
      api.get<{ data: MultiBalance[] }>("/api/v1/my/balances")
        .then((d) => setBalances(d.data ?? []))
        .catch(() => {});
      api.get<ProfileData>("/api/v1/profile")
        .then((d) => setProfile(d))
        .catch(() => {});
      api.get<TierResponse>("/api/v1/my/tier")
        .then((d) => setTier(d.tier))
        .catch(() => {});
    }
  }, [open]);

  // Group menu items by `group` field, preserving original order
  const groupedItems: { name: string; items: DrawerMenuItem[] }[] = [];
  const groupMap = new Map<string, DrawerMenuItem[]>();
  for (const item of menuItems) {
    if (item.visible === false) continue;
    const groupName = item.group || "เมนู";
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
      groupedItems.push({ name: groupName, items: groupMap.get(groupName)! });
    }
    groupMap.get(groupName)!.push(item);
  }

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "ผู้เยี่ยมชม";

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-y-0 w-full max-w-[480px] left-1/2 -translate-x-1/2 z-[9990] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 cursor-pointer" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 w-full max-w-[480px] left-1/2 -translate-x-1/2 pointer-events-none z-[9999] p-4 sm:p-5">
        <div
          className="relative w-full max-w-[340px] h-full flex flex-col pointer-events-auto transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ transform: open ? "translateX(0)" : "translateX(-120%)" }}
        >
          {/* Main Floating Card */}
          <div className="flex-1 bg-[#F6F8F9] rounded-[32px] overflow-hidden shadow-2xl flex flex-col relative w-full h-full max-h-full">
            
            {/* White Header Area */}
            <div className="bg-white px-6 pt-6 pb-20 relative rounded-b-[32px] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Avatar Area */}
              <div className="flex flex-col gap-3 mt-4">
                <div className="w-16 h-16 rounded-full border-2 border-[var(--jh-green)] p-0.5 relative">
                  <img
                    src={profile?.profile_picture || profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`}
                    alt="avatar"
                    className="w-full h-full rounded-full object-cover bg-gray-100"
                  />
                </div>
                
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[22px] font-bold text-gray-900 leading-none">
                      {loggedIn ? displayName : "ผู้เยี่ยมชม"}
                    </h2>
                    {loggedIn && (
                      <div className="w-5 h-5 rounded-full bg-[#10C836] flex items-center justify-center text-white shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {loggedIn && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-black text-xs font-black px-2.5 py-1 rounded shadow-sm border border-black/10" style={{ background: tier?.color || "#FFC600" }}>
                        {tier?.name || "Bronze"}
                      </span>
                      <span className="bg-gray-100 text-gray-600 font-bold text-xs px-2.5 py-1 rounded">
                        แต้ม {(primaryBalance?.balance ?? 0).toLocaleString()} 🪙 | เพชร {(diamondBalance?.balance ?? 0).toLocaleString()} 💎
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scan Action Button (Overlaying the gap) */}
            <div className="px-5 -mt-14 relative z-20">
              <button
                onClick={() => navigate("/scan")}
                className="w-full bg-[linear-gradient(270deg,#4DA735_0%,#31893D_100%)] rounded-[20px] p-4 flex items-center justify-between text-white shadow-[0_8px_16px_-6px_rgba(77,167,53,0.4)] transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center bg-white/10 shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-base font-bold leading-none mb-1">สแกนคิวอาร์โค้ด</div>
                    <div className="text-[11px] text-white/90">สแกนง่าย แลกฟรี ทันใจ</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6 space-y-5 no-scrollbar">
              
              {/* Menu Sections — รายการมาจาก /api/v1/public/nav-menu/drawer
                  group แรก (index 0) ใช้สีเขียว, group ถัดไปใช้สีเทา (style เดิม) */}
              {groupedItems.map((group, gIdx) => {
                const isFirstGroup = gIdx === 0;
                return (
                  <div
                    key={group.name}
                    className="bg-white rounded-[24px] p-2 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                  >
                    <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-gray-400 mb-1">
                      {group.name}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => navigate(item.link)}
                          className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isFirstGroup
                                  ? "bg-[#E8F5E9] text-[#2E7D32]"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {DRAWER_ICONS[item.icon] || DRAWER_ICONS.support}
                            </div>
                            <span className="text-[15px] font-bold text-gray-800">{item.label}</span>
                          </div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Logout Button */}
              {loggedIn && (
                <button
                  onClick={handleLogout}
                  className="w-full bg-white rounded-[24px] p-4 flex items-center justify-center gap-2 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-colors hover:bg-red-50 text-[#FF3B30] mt-6"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H9m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h6a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-[15px] font-bold">ออกจากระบบ</span>
                </button>
              )}
              
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
