"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLoggedIn, setPostLoginRedirect } from "@/lib/auth";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/otp",
  "/auth/line/callback",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    const query = typeof window !== "undefined" ? window.location.search : "";
    const currentPath = query ? `${pathname}${query}` : pathname;
    if (publicPath) {
      setAuthorized(true);
      return;
    }

    if (isLoggedIn()) {
      setAuthorized(true);
      return;
    }

    setAuthorized(false);
    setPostLoginRedirect(currentPath);
    router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
  }, [pathname, publicPath, router]);

  if (!authorized) {
    return <div className="min-h-screen bg-background" />;
  }

  return <>{children}</>;
}
