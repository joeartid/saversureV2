"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  sectionRegistry,
  type SectionDefinition,
} from "@/components/sections/registry";

interface PageConfigResponse {
  sections: SectionDefinition[];
  version?: number;
}

interface PageRendererProps {
  pageSlug: string;
  /** Optional override for empty state. Defaults to a brand-agnostic placeholder. */
  fallback?: React.ReactNode;
}

function DefaultEmptyState({ pageSlug }: { pageSlug: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4 opacity-40">📄</div>
      <h2 className="text-lg font-bold text-foreground">
        หน้านี้ยังไม่ได้ตั้งค่า
      </h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        กรุณาสร้าง layout ของหน้านี้ผ่าน Page Builder
      </p>
      <code className="mt-3 text-[11px] text-muted-foreground/70 bg-muted/40 px-2 py-1 rounded">
        slug: {pageSlug}
      </code>
    </div>
  );
}

export default function PageRenderer({
  pageSlug,
  fallback,
}: PageRendererProps) {
  const [sections, setSections] = useState<SectionDefinition[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    api
      .get<PageConfigResponse>(
        `/api/v1/public/page-config/${encodeURIComponent(pageSlug)}`,
      )
      .then((res) => {
        if (res.sections?.length) {
          setSections(res.sections);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [pageSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--jh-green)] border-t-transparent" />
      </div>
    );
  }

  const visibleSections =
    sections
      ?.filter((s) => s.visible !== false)
      .sort((a, b) => a.order - b.order) ?? [];

  if (error || visibleSections.length === 0) {
    return <>{fallback ?? <DefaultEmptyState pageSlug={pageSlug} />}</>;
  }

  return (
    <>
      {visibleSections.map((section) => {
        const Component = sectionRegistry[section.type];
        if (!Component) {
          return null;
        }
        return (
          <Component
            key={section.id}
            {...(section.props as Record<string, unknown>)}
          />
        );
      })}
    </>
  );
}
