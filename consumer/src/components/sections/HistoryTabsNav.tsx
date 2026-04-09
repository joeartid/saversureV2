"use client";

import { useEffect, useState } from "react";
import HistoryTabs from "@/components/HistoryTabs";
import { isLoggedIn } from "@/lib/auth";

interface HistoryTabsNavProps {
  overlap?: boolean;
}

export default function HistoryTabsNav({ overlap = true }: HistoryTabsNavProps) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  if (!loggedIn) return null;
  return <HistoryTabs overlap={overlap} />;
}
