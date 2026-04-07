"use client";

import { useEffect, useState } from "react";
import { isLoggedIn, logout } from "@/lib/auth";

interface Props {
  label?: string;
  confirm_message?: string;
}

export default function ProfileLogoutButton({
  label = "ออกจากระบบ",
  confirm_message = "",
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  if (!loggedIn) return null;

  const handleClick = () => {
    if (confirm_message && !confirm(confirm_message)) return;
    logout();
  };

  return (
    <div className="px-4 py-8">
      <button
        onClick={handleClick}
        className="w-full flex justify-center items-center gap-2 rounded-2xl py-3.5 bg-red-50 text-[16px] font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {label}
      </button>
    </div>
  );
}
