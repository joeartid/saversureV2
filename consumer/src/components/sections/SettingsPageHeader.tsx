"use client";

import PageHeader from "@/components/PageHeader";

interface SettingsPageHeaderProps {
  title?: string;
  subtitle?: string;
  back_href?: string;
}

export default function SettingsPageHeader({
  title = "การตั้งค่าแอปพลิเคชัน",
  subtitle = "จัดการการแจ้งเตือนและความเป็นส่วนตัว",
  back_href = "/profile",
}: SettingsPageHeaderProps) {
  return <PageHeader title={title} subtitle={subtitle} backHref={back_href} />;
}
