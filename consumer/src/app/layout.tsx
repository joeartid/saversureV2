import type { Metadata, Viewport } from "next";
import TenantProvider from "@/components/TenantProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jula's Herb",
  description: "สะสมแต้ม แลกสิทธิพิเศษ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head />
      <body className="min-h-screen bg-[var(--surface-dim)]">
        <TenantProvider>{children}</TenantProvider>
      </body>
    </html>
  );
}
