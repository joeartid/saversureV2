"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ImageUpload } from "@/components/ui/image-upload";
import toast from "react-hot-toast";

interface MenuItem {
  icon: string;
  label: string;
  link: string;
  visible: boolean;
  badge_type?: string;
  group?: string;
}

interface NavMenuData {
  id?: string;
  menu_type: string;
  items: MenuItem[];
  version?: number;
}

interface VersionEntry {
  version: number;
  items: MenuItem[];
  updated_by?: string | null;
  updated_at: string;
}

const MENU_TYPES = [
  { value: "bottom_nav", label: "Bottom Navigation" },
  { value: "drawer", label: "Drawer / Side Menu" },
  { value: "header", label: "Header" },
];

const ICON_OPTIONS = [
  { value: "home", label: "Home", group: "ทั่วไป" },
  { value: "scan", label: "Scan / QR", group: "ทั่วไป" },
  { value: "gift", label: "Gift", group: "ทั่วไป" },
  { value: "history", label: "History / Clock", group: "ทั่วไป" },
  { value: "user", label: "User / Profile", group: "ทั่วไป" },
  { value: "news", label: "News", group: "ทั่วไป" },
  { value: "star", label: "Star", group: "ทั่วไป" },
  { value: "heart", label: "Heart", group: "ทั่วไป" },
  { value: "trophy", label: "Trophy", group: "ทั่วไป" },
  { value: "settings", label: "Settings", group: "ทั่วไป" },
  { value: "bell", label: "Bell / Notification", group: "ทั่วไป" },
  { value: "support", label: "Support / Help", group: "ทั่วไป" },
  { value: "wallet", label: "Wallet", group: "การเงิน" },
  { value: "coin", label: "Coin / Points", group: "การเงิน" },
  { value: "tag", label: "Tag / Promotion", group: "การเงิน" },
  { value: "cart", label: "Cart / Shopping", group: "การเงิน" },
  { value: "receipt", label: "Receipt", group: "การเงิน" },
  { value: "camera", label: "Camera", group: "มีเดีย" },
  { value: "photo", label: "Photo / Gallery", group: "มีเดีย" },
  { value: "share", label: "Share", group: "มีเดีย" },
  { value: "link", label: "Link", group: "มีเดีย" },
  { value: "map", label: "Map / Location", group: "อื่นๆ" },
  { value: "phone", label: "Phone", group: "อื่นๆ" },
  { value: "mail", label: "Mail / Email", group: "อื่นๆ" },
  { value: "calendar", label: "Calendar", group: "อื่นๆ" },
  { value: "bookmark", label: "Bookmark", group: "อื่นๆ" },
  { value: "flag", label: "Flag", group: "อื่นๆ" },
  { value: "shield", label: "Shield / Security", group: "อื่นๆ" },
  { value: "bolt", label: "Bolt / Lightning", group: "อื่นๆ" },
  { value: "fire", label: "Fire / Hot", group: "อื่นๆ" },
  { value: "sparkle", label: "Sparkle", group: "อื่นๆ" },
  { value: "chart", label: "Chart / Stats", group: "อื่นๆ" },
  { value: "check", label: "Check / Success", group: "อื่นๆ" },
  { value: "info", label: "Info", group: "อื่นๆ" },
  { value: "globe", label: "Globe / Web", group: "อื่นๆ" },
  { value: "dice", label: "Dice / Lucky Draw", group: "อื่นๆ" },
  { value: "megaphone", label: "Megaphone", group: "อื่นๆ" },
];

const ICON_PATHS: Record<string, string> = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  scan: "M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z",
  gift: "M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
  history: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  news: "M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5",
  star: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  heart: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z",
  trophy: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.996.436-1.75 1.375-1.75 2.514 0 1.667 1.398 3 3.063 3 .398 0 .779-.074 1.13-.213M18.75 4.236c.996.436 1.75 1.375 1.75 2.514 0 1.667-1.398 3-3.063 3a3.157 3.157 0 01-1.13-.213M12 3v6.75",
  settings: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z",
  bell: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  support: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
  wallet: "M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h.75A2.25 2.25 0 0118 6v.75M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  coin: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
  tag: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z",
  cart: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",
  receipt: "M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  camera: "M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z",
  photo: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  share: "M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z",
  link: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
  map: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  phone: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
  mail: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  bookmark: "M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z",
  flag: "M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5",
  shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  bolt: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  fire: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z",
  sparkle: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z",
  chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  check: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  info: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  globe: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418",
  dice: "M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25",
  megaphone: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46",
};

function isImageUrl(v: string) {
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/");
}

function IconPreview({ icon, className = "w-5 h-5" }: { icon: string; className?: string }) {
  if (isImageUrl(icon)) {
    return <img src={icon} alt="" className={`${className} object-contain rounded-sm`} />;
  }
  const d = ICON_PATHS[icon];
  if (!d) return <span className={className}>●</span>;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const STATIC_LINK_OPTIONS = [
  { value: "/", label: "🏠 หน้าหลัก" },
  { value: "/scan", label: "📷 สแกน QR Code" },
  { value: "/rewards", label: "🎁 แลกของรางวัล" },
  { value: "/wallet", label: "💰 กระเป๋าเงิน" },
  { value: "/history", label: "📋 ประวัติสแกน" },
  { value: "/history/redeems", label: "🏆 ประวัติแลกรางวัล" },
  { value: "/profile", label: "👤 โปรไฟล์" },
  { value: "/news", label: "📰 ข่าวสาร" },
  { value: "/missions", label: "🎯 ภารกิจ" },
  { value: "/lucky-draw", label: "🎰 ลุ้นรางวัล" },
  { value: "/donations", label: "❤️ บริจาค" },
  { value: "/badges", label: "🏅 เหรียญตรา" },
  { value: "/leaderboard", label: "📊 กระดานผู้นำ" },
  { value: "/notifications", label: "🔔 แจ้งเตือน" },
  { value: "/support", label: "💬 ช่วยเหลือ" },
  { value: "/privacy", label: "🔒 นโยบายความเป็นส่วนตัว" },
  { value: "/login", label: "🔑 เข้าสู่ระบบ" },
];

const BUILT_IN_SLUGS = new Set(["home", "scan", "rewards", "history", "profile", "news"]);

interface PageConfigItem {
  page_slug: string;
  status: string;
}

const DEFAULT_BOTTOM_NAV: MenuItem[] = [
  { icon: "home", label: "หน้าหลัก", link: "/", visible: true },
  { icon: "scan", label: "สแกน", link: "/scan", visible: true },
  { icon: "history", label: "ประวัติ", link: "/history", visible: true },
  { icon: "user", label: "บัญชี", link: "/profile", visible: true },
];

export default function MenuEditorPage() {
  const [activeType, setActiveType] = useState("bottom_nav");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [linkOptions, setLinkOptions] = useState(STATIC_LINK_OPTIONS);
  const [version, setVersion] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    api.get<{ data: PageConfigItem[] }>("/api/v1/page-configs")
      .then((res) => {
        const customPages = (res.data || [])
          .filter((pc) => !BUILT_IN_SLUGS.has(pc.page_slug))
          .map((pc) => ({
            value: `/p/${pc.page_slug}`,
            label: `📄 ${pc.page_slug} (custom)`,
          }));
        if (customPages.length > 0) {
          setLinkOptions([...STATIC_LINK_OPTIONS, ...customPages]);
        }
      })
      .catch(() => {});
  }, []);

  const fetchMenu = useCallback(async (menuType: string) => {
    setLoading(true);
    setDirty(false);
    setShowHistory(false);
    try {
      const data = await api.get<NavMenuData>(`/api/v1/nav-menus/${menuType}`);
      setItems(data.items?.length ? data.items : []);
      setVersion(data.version || 0);
    } catch {
      if (menuType === "bottom_nav") {
        setItems(DEFAULT_BOTTOM_NAV);
      } else {
        setItems([]);
      }
      setVersion(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVersions = async (menuType: string) => {
    setLoadingVersions(true);
    try {
      const data = await api.get<{ data: VersionEntry[] }>(`/api/v1/nav-menus/${menuType}/versions`);
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
      const result = await api.post<NavMenuData>(`/api/v1/nav-menus/${activeType}/restore`, { version: ver });
      setItems(result.items || []);
      setVersion(result.version || 0);
      setShowHistory(false);
      setDirty(false);
      toast.success(`Restored v${ver}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    }
  };

  useEffect(() => {
    fetchMenu(activeType);
  }, [activeType, fetchMenu]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const result = await api.put<NavMenuData>("/api/v1/nav-menus", {
        menu_type: activeType,
        items,
      });
      setVersion(result.version || version + 1);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const newItem: MenuItem = { icon: "star", label: "New Item", link: "/", visible: true };
    if (activeType === "drawer") {
      newItem.group = "เมนู";
    }
    setItems((prev) => [...prev, newItem]);
    setDirty(true);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const updateItem = (idx: number, key: string, value: unknown) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    );
    setDirty(true);
  };

  const moveItem = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
    setDirty(true);
  };

  const fieldClass =
    "w-full h-[36px] px-2.5 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[12px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Menu Editor
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            จัดการเมนู navigation ของ consumer frontend
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-[12px] text-[var(--md-warning)] font-medium">
              ● มีการเปลี่ยนแปลง
            </span>
          )}
          {saved && (
            <span className="text-[12px] text-[var(--md-success)] font-medium">
              ✓ บันทึกแล้ว
            </span>
          )}
          {version > 0 && (
            <span className="text-[11px] text-[var(--md-on-surface-variant)] font-mono">
              v{version}
            </span>
          )}
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) fetchVersions(activeType);
            }}
            className="h-[40px] px-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] transition-all"
          >
            History
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Menu Type Tabs */}
      <div className="flex gap-2 mb-6">
        {MENU_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            className={`h-[36px] px-4 rounded-[var(--md-radius-sm)] text-[13px] font-medium transition-all ${
              activeType === t.value
                ? "bg-[var(--md-primary)] text-white"
                : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Version History Panel */}
      {showHistory && (
        <div className="mb-6 bg-[var(--md-surface)] border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-medium text-[var(--md-on-surface)]">
              Version History — {MENU_TYPES.find((t) => t.value === activeType)?.label}
            </p>
            <button
              onClick={() => setShowHistory(false)}
              className="text-[var(--md-on-surface-variant)] text-[14px]"
            >
              ✕
            </button>
          </div>
          {loadingVersions ? (
            <p className="text-[12px] text-[var(--md-on-surface-variant)]">Loading...</p>
          ) : versions.length === 0 ? (
            <p className="text-[12px] text-[var(--md-on-surface-variant)]">
              ยังไม่มี history — กด Save ครั้งแรกเพื่อสร้าง snapshot
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.version}
                  className="flex items-center justify-between p-2.5 rounded bg-[var(--md-surface-container)] text-[12px]"
                >
                  <div>
                    <span className="font-mono font-medium text-[var(--md-on-surface)]">
                      v{v.version}
                    </span>
                    <span className="ml-3 text-[var(--md-on-surface-variant)]">
                      {v.items.length} items
                    </span>
                    <span className="ml-3 text-[var(--md-on-surface-variant)] text-[11px]">
                      {v.updated_at}
                    </span>
                  </div>
                  <button
                    onClick={() => restoreVersion(v.version)}
                    className="text-[var(--md-primary)] font-medium hover:underline text-[12px]"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
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
          {/* Items List */}
          <div className="flex-1">
            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-medium text-[var(--md-on-surface)]">
                  Menu Items ({items.length})
                </h2>
                <button
                  onClick={addItem}
                  className="h-[32px] px-3 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-sm)] text-[12px] font-medium"
                >
                  + เพิ่ม
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-center py-10 text-[var(--md-on-surface-variant)] text-[13px]">
                  ยังไม่มี menu item — กด &quot;+ เพิ่ม&quot; เพื่อเริ่ม
                </p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-[var(--md-radius-sm)] p-4 transition-all ${
                        item.visible
                          ? "border-[var(--md-outline-variant)] bg-[var(--md-surface)]"
                          : "border-[var(--md-outline-variant)] bg-[var(--md-surface-container)] opacity-60"
                      }`}
                    >
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] text-[var(--md-on-surface-variant)] uppercase mb-1 block">
                            Icon
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] text-[var(--md-primary)]">
                              <IconPreview icon={item.icon} className="w-[18px] h-[18px]" />
                            </div>
                            {isImageUrl(item.icon) ? (
                              <div className="flex-1 flex gap-1">
                                <div className="flex-1 overflow-hidden">
                                  <p className="text-[10px] text-[var(--md-on-surface-variant)] truncate" title={item.icon}>
                                    {item.icon.split("/").pop()}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updateItem(idx, "icon", "star")}
                                  title="เปลี่ยนเป็น icon"
                                  className="h-[28px] px-2 text-[10px] font-medium text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] border border-[var(--md-outline)]"
                                >
                                  ⬅ Icon
                                </button>
                              </div>
                            ) : (
                              <div className="flex-1 relative group/icon">
                                <select
                                  value={item.icon}
                                  onChange={(e) => {
                                    if (e.target.value === "__upload__") {
                                      e.target.value = item.icon;
                                    } else {
                                      updateItem(idx, "icon", e.target.value);
                                    }
                                  }}
                                  className={fieldClass}
                                >
                                  {(() => {
                                    const groups: Record<string, typeof ICON_OPTIONS> = {};
                                    ICON_OPTIONS.forEach((o) => {
                                      const g = o.group || "อื่นๆ";
                                      if (!groups[g]) groups[g] = [];
                                      groups[g].push(o);
                                    });
                                    return Object.entries(groups).map(([group, opts]) => (
                                      <optgroup key={group} label={group}>
                                        {opts.map((o) => (
                                          <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                      </optgroup>
                                    ));
                                  })()}
                                </select>
                              </div>
                            )}
                          </div>
                          {!isImageUrl(item.icon) && (
                            <div className="mt-1.5">
                              <ImageUpload
                                value=""
                                onChange={(url) => { if (url) updateItem(idx, "icon", url); }}
                                label=""
                                compact
                                showAiGenerate={false}
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-[var(--md-on-surface-variant)] uppercase mb-1 block">
                            Label
                          </label>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateItem(idx, "label", e.target.value)}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[var(--md-on-surface-variant)] uppercase mb-1 block">
                            Link
                          </label>
                          {linkOptions.some((o) => o.value === item.link) ? (
                            <div>
                              <select
                                value={item.link}
                                onChange={(e) => {
                                  if (e.target.value === "__custom__") {
                                    updateItem(idx, "link", "/custom");
                                  } else {
                                    updateItem(idx, "link", e.target.value);
                                  }
                                }}
                                className={fieldClass}
                              >
                                {linkOptions.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                                <option value="__custom__">✏️ กำหนดเอง...</option>
                              </select>
                              <p className="mt-0.5 text-[10px] font-mono text-[var(--md-primary)] truncate" title={item.link}>
                                {item.link}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={item.link}
                                  onChange={(e) => updateItem(idx, "link", e.target.value)}
                                  className={fieldClass}
                                  placeholder="/custom-path"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItem(idx, "link", "/")}
                                  title="เลือกจากรายการ"
                                  className="h-[36px] w-[36px] shrink-0 flex items-center justify-center border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] text-[12px]"
                                >
                                  ▼
                                </button>
                              </div>
                              <p className="mt-0.5 text-[10px] font-mono text-[var(--md-on-surface-variant)] truncate">
                                custom path
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-end gap-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.visible}
                              onChange={(e) => updateItem(idx, "visible", e.target.checked)}
                              className="w-3.5 h-3.5 accent-[var(--md-primary)]"
                            />
                            <span className="text-[11px] text-[var(--md-on-surface-variant)]">
                              Visible
                            </span>
                          </label>
                          <button
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            className="h-[28px] w-[28px] flex items-center justify-center rounded text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === items.length - 1}
                            className="h-[28px] w-[28px] flex items-center justify-center rounded text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container)] disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeItem(idx)}
                            className="h-[28px] w-[28px] flex items-center justify-center rounded text-[var(--md-error)] hover:bg-[var(--md-error-light)]/20"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Group field — เฉพาะ drawer */}
                      {activeType === "drawer" && (
                        <div className="mt-2 pt-2 border-t border-[var(--md-outline-variant)]">
                          <label className="text-[10px] text-[var(--md-on-surface-variant)] uppercase mb-1 block">
                            กลุ่ม / หัวข้อ section (เว้นว่าง = ใช้ &quot;เมนู&quot;)
                          </label>
                          <input
                            type="text"
                            value={item.group || ""}
                            onChange={(e) => updateItem(idx, "group", e.target.value)}
                            placeholder="เช่น บริการส่วนตัว, ช่วยเหลือและการตั้งค่า"
                            className={fieldClass}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="xl:w-[320px] flex-shrink-0">
            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-5 sticky top-8">
              <h3 className="text-[14px] font-medium text-[var(--md-on-surface)] mb-4">
                Preview
              </h3>
              {activeType === "bottom_nav" && (
                <div className="border border-[var(--md-outline-variant)] rounded-[12px] overflow-hidden">
                  <div className="h-[200px] bg-[var(--md-surface-container)] flex items-center justify-center text-[var(--md-on-surface-variant)] text-[12px]">
                    Page Content
                  </div>
                  <div className="flex items-center justify-around h-[56px] bg-white border-t border-[var(--md-outline-variant)]">
                    {items
                      .filter((i) => i.visible)
                      .map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-0.5 text-[var(--md-on-surface-variant)]">
                          <IconPreview icon={item.icon} className="w-[18px] h-[18px]" />
                          <span className="text-[9px]">
                            {item.label}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {activeType === "drawer" && (
                <div className="border border-[var(--md-outline-variant)] rounded-[12px] overflow-hidden">
                  <div className="p-3 bg-[var(--md-primary)] text-white text-[12px] font-medium">
                    Menu
                  </div>
                  <div className="p-2">
                    {items
                      .filter((i) => i.visible)
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-2.5 rounded text-[12px] text-[var(--md-on-surface)] hover:bg-[var(--md-surface-container)]"
                        >
                          <span className="text-[var(--md-on-surface-variant)]">
                            <IconPreview icon={item.icon} className="w-[14px] h-[14px]" />
                          </span>
                          {item.label}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {activeType === "header" && (
                <div className="border border-[var(--md-outline-variant)] rounded-[12px] overflow-hidden">
                  <div className="flex items-center justify-between px-4 h-[48px] bg-[var(--md-primary)] text-white">
                    <span className="text-[13px] font-medium">Brand</span>
                    <div className="flex gap-3 items-center">
                      {items
                        .filter((i) => i.visible)
                        .map((item, idx) => (
                          <span key={idx} className="flex items-center gap-1 text-[10px]">
                            <IconPreview icon={item.icon} className="w-3 h-3" />
                            {item.label}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="h-[160px] bg-[var(--md-surface-container)] flex items-center justify-center text-[12px] text-[var(--md-on-surface-variant)]">
                    Content
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
