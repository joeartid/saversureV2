"use client";

interface SettingsAppVersionFooterProps {
  text?: string;
}

export default function SettingsAppVersionFooter({
  text = "APP VERSION 2.0.1 (Build 491)",
}: SettingsAppVersionFooterProps) {
  return (
    <div className="text-center pt-8">
      <p className="text-[10px] text-gray-300 font-mono">{text}</p>
    </div>
  );
}
