"use client";

import { useEffect, useState } from "react";
import HistoryTabs from "@/components/HistoryTabs";
import { isLoggedIn } from "@/lib/auth";

export default function HistoryTabsNav() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  if (!loggedIn) return null;
  return <HistoryTabs />;
}
