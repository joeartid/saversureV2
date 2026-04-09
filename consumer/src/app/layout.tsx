import type { Metadata, Viewport } from "next";
import TenantProvider from "@/components/TenantProvider";
import AuthGate from "@/components/AuthGate";
import PopupRenderer from "@/components/PopupRenderer";
import { CurrencyProvider } from "@/lib/currency-context";
import { Toaster } from "react-hot-toast";
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
      <head>
        <link rel="preload" href="/assets/fonts/DBHeavent.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/assets/fonts/DBHeavent-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/assets/fonts/DBHeaventt-Light.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <TenantProvider>
          <AuthGate>
            <CurrencyProvider>
              {children}
              <PopupRenderer />
              <Toaster position="top-center" reverseOrder={false} />
            </CurrencyProvider>
          </AuthGate>
        </TenantProvider>
      </body>
    </html>
  );
}
