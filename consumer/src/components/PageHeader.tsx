"use client";

import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  gradient?: string;
  backHref?: string;
  /** Extra content rendered inside the header (e.g. count badge) */
  children?: React.ReactNode;
}

const defaultGradient =
  "linear-gradient(277.42deg, #3C9B4D -13.4%, #7DBD48 80.19%)";

export default function PageHeader({
  title,
  subtitle,
  gradient,
  backHref,
  children,
}: PageHeaderProps) {
  return (
    <div
      className="bg-[length:200%_200%] animate-gradient px-5 pt-8 pb-10 text-white relative overflow-hidden"
      style={{ backgroundImage: gradient || defaultGradient }}
    >
      {/* Floating decorative circles */}
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 animate-float" />
      <div className="absolute left-12 bottom-2 h-16 w-16 rounded-full bg-white/5 animate-float-delay-1" />
      <div className="absolute right-20 bottom-6 h-8 w-8 rounded-full bg-white/8 animate-float-delay-2" />

      <div className="relative flex items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 mt-0.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        <div className="flex-1">
          <h1 className="text-[40px] font-black tracking-tight leading-[1] mb-0 drop-shadow-md">{title}</h1>
          {subtitle && (
            <p className="text-[17px] font-medium text-white/95 -mt-1.5">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
