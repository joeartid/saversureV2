"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { TenantProvider } from "@/lib/tenant-context";
import Sidebar from "@/components/ui/sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    }
  }, [router]);

  return (
    <TenantProvider>
      <div className="flex min-h-screen bg-[var(--md-surface-dim)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-8">
            {children}
          </div>
        </main>
      </div>
    </TenantProvider>
  );
}
