"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isLoggedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  icon?: string;
  title?: string;
  description?: string;
  cta_text?: string;
  cta_link?: string;
  /** "profile_incomplete" | "phone_unverified" | "always" */
  show_if?: string;
}

interface ProfileData {
  profile_completed?: boolean;
  phone_verified?: boolean;
}

export default function ProfileWarningAlert({
  icon = "⚠️",
  title = "กรอกข้อมูลให้ครบถ้วน",
  description = "ยืนยันรหัส OTP และข้อมูลเพื่อรับสิทธิประโยชน์",
  cta_text = "รีบทำเลย",
  cta_link = "/register/complete",
  show_if = "profile_incomplete",
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    if (!li) {
      setLoading(false);
      return;
    }
    api
      .get<ProfileData>("/api/v1/profile")
      .then((d) => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (!loggedIn || loading) return null;

  // Conditional show logic
  let shouldShow = false;
  if (show_if === "always") {
    shouldShow = true;
  } else if (show_if === "profile_incomplete") {
    shouldShow = !profile?.profile_completed;
  } else if (show_if === "phone_unverified") {
    shouldShow = !profile?.phone_verified;
  }

  if (!shouldShow) return null;

  return (
    <div className="px-4 mt-3 animate-slide-up">
      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
              {icon}
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-bold text-amber-900">{title}</p>
              <p className="text-[12px] text-amber-700/80 mt-0.5 leading-tight">
                {description}
              </p>
            </div>
            {cta_text && (
              <Link
                href={cta_link}
                className="rounded-full bg-amber-600 px-3 py-1.5 text-[14px] font-bold text-white whitespace-nowrap"
              >
                {cta_text}
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
