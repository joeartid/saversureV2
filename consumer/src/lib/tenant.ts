const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
const ENV_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || "";

export interface BrandingData {
  tenant_id: string;
  logo_url: string;
  favicon_url: string;
  brand_name: string;
  primary_color: string;
  accent_color: string;
  bg_color: string;
  header_bg: string;
  custom_css: string;
  welcome_text: string;
  footer_text: string;
}

let resolvedTenantId = ENV_TENANT_ID;
let resolvedBranding: BrandingData | null = null;

export function getTenantId(): string {
  return resolvedTenantId;
}

export function getBranding(): BrandingData | null {
  return resolvedBranding;
}

export function extractSlugFromHostname(hostname: string): string | null {
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub !== "www" && sub !== "app" && sub !== "api" && sub !== "admin" && sub !== "qr") {
      return sub;
    }
  }
  return null;
}

export async function resolveTenant(): Promise<BrandingData | null> {
  if (typeof window === "undefined") return null;

  const slug = extractSlugFromHostname(window.location.hostname);

  if (slug) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/branding-by-slug?slug=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data: BrandingData = await res.json();
        resolvedTenantId = data.tenant_id;
        resolvedBranding = data;
        return data;
      }
    } catch {
      // Fall through to env-based tenant
    }
  }

  if (ENV_TENANT_ID) {
    resolvedTenantId = ENV_TENANT_ID;
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/branding-by-slug?slug=`, {
        headers: { "X-Tenant-ID": ENV_TENANT_ID },
      });
      if (!res.ok) {
        const brandRes = await fetch(`${API_BASE}/api/v1/public/branding`, {
          headers: { "X-Tenant-ID": ENV_TENANT_ID },
        });
        if (brandRes.ok) {
          const data = await brandRes.json();
          resolvedBranding = { ...data, tenant_id: ENV_TENANT_ID };
          return resolvedBranding;
        }
      }
    } catch {
      // branding unavailable, use defaults
    }
  }

  return null;
}
