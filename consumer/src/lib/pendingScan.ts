"use client";

export interface PendingScanContext {
  code: string;
  source?: "qr" | "manual" | "line" | "email" | "google" | "register";
  created_at: number;
}

const STORAGE_KEY = "pending_scan_context";

function normalizeCode(code: string | null | undefined): string {
  return (code || "").trim().toUpperCase();
}

export function setPendingScan(code: string, source?: PendingScanContext["source"]) {
  if (typeof window === "undefined") return;
  const normalized = normalizeCode(code);
  if (!normalized) return;

  const payload: PendingScanContext = {
    code: normalized,
    source,
    created_at: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getPendingScan(): PendingScanContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingScanContext;
    if (!parsed?.code) return null;
    return {
      code: normalizeCode(parsed.code),
      source: parsed.source,
      created_at: parsed.created_at || Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearPendingScan() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function resolvePendingCodeFromSearch(search: URLSearchParams): string {
  const queryCode = normalizeCode(
    search.get("code") ||
      search.get("pending_code") ||
      search.get("redirect_code")
  );

  if (queryCode) return queryCode;
  return getPendingScan()?.code || "";
}

export function getPendingScanTarget(fallback = "/scan"): string {
  const pending = getPendingScan();
  if (!pending?.code) return fallback;
  return `/scan?code=${encodeURIComponent(pending.code)}&auto=1`;
}
