import type { Metadata, Viewport } from "next";
import TenantProvider from "@/components/TenantProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saversure",
  description: "Scan, collect points, redeem rewards",
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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--surface-dim)]">
        <TenantProvider>{children}</TenantProvider>
      </body>
    </html>
  );
}
