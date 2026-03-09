"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "./api";
import { getUser } from "./auth";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  shortcode?: string;
  status: string;
}

interface TenantContextValue {
  tenants: TenantInfo[];
  activeTenantId: string;
  activeTenant: TenantInfo | null;
  isSuperAdmin: boolean;
  switchTenant: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
  loading: boolean;
}

const STORAGE_KEY = "active_tenant_override";

const TenantContext = createContext<TenantContextValue>({
  tenants: [],
  activeTenantId: "",
  activeTenant: null,
  isSuperAdmin: false,
  switchTenant: () => {},
  refreshTenants: async () => {},
  loading: true,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [activeTenantId, setActiveTenantId] = useState("");
  const [loading, setLoading] = useState(true);

  const user = getUser();
  const isSuperAdmin = user?.role === "super_admin";
  const jwtTenantId = user?.tenant_id || "";

  const fetchTenants = useCallback(async () => {
    if (!isSuperAdmin) {
      setTenants([]);
      setActiveTenantId(jwtTenantId);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get<{ data: TenantInfo[] }>("/api/v1/tenants");
      const list = res?.data || [];
      setTenants(list);

      const saved = localStorage.getItem(STORAGE_KEY);
      const validSaved = saved && list?.some((t) => t.id === saved);
      setActiveTenantId(validSaved ? saved! : jwtTenantId);
    } catch {
      setTenants([]);
      setActiveTenantId(jwtTenantId);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, jwtTenantId]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      setActiveTenantId(tenantId);
      if (tenantId === jwtTenantId) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, tenantId);
      }
      window.location.reload();
    },
    [jwtTenantId],
  );

  const activeTenant = tenants.find((t) => t.id === activeTenantId) || null;

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenantId,
        activeTenant,
        isSuperAdmin,
        switchTenant,
        refreshTenants: fetchTenants,
        loading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  return useContext(TenantContext);
}

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}
