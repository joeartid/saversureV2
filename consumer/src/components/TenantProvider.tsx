"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveTenant, getTenantId, type BrandingData } from "@/lib/tenant";

interface TenantContextValue {
  tenantId: string;
  branding: BrandingData | null;
  brandName: string;
  ready: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenantId: "",
  branding: null,
  brandName: "Saversure",
  ready: false,
});

export function useTenant() {
  return useContext(TenantContext);
}

function applyBrandingCSS(branding: BrandingData) {
  const root = document.documentElement;
  if (branding.primary_color) root.style.setProperty("--primary", branding.primary_color);
  if (branding.accent_color) root.style.setProperty("--primary-dark", branding.accent_color);
  if (branding.bg_color) root.style.setProperty("--surface-dim", branding.bg_color);
  if (branding.header_bg) root.style.setProperty("--primary-light", branding.header_bg);

  if (branding.custom_css) {
    let style = document.getElementById("tenant-custom-css");
    if (!style) {
      style = document.createElement("style");
      style.id = "tenant-custom-css";
      document.head.appendChild(style);
    }
    style.textContent = branding.custom_css;
  }

  if (branding.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.favicon_url;
  }

  if (branding.brand_name) {
    document.title = branding.brand_name;
  }
}

const ENV_TENANT_FALLBACK = process.env.NEXT_PUBLIC_TENANT_ID || "";

export default function TenantProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [ready, setReady] = useState(false);
  const [tenantId, setTenantId] = useState(ENV_TENANT_FALLBACK);

  useEffect(() => {
    resolveTenant().then((b) => {
      if (b) {
        setBranding(b);
        applyBrandingCSS(b);
      }
      setTenantId(getTenantId());
      setReady(true);
    });
  }, []);

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        branding,
        brandName: branding?.brand_name || "Saversure",
        ready,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
