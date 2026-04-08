"use client";

interface Props {
  title?: string;
  subtitle?: string;
  align?: "left" | "center";
}

export default function HomeSectionHeading({
  title = "",
  subtitle = "",
  align = "left",
}: Props) {
  if (!title && !subtitle) return null;

  const alignClass = align === "center" ? "text-center" : "text-left";

  return (
    <div className={`jh-rewards-section ${alignClass}`}>
      {title && <h2 className="jh-section-title">{title}</h2>}
      {subtitle && (
        <p className="text-[13px] text-[var(--on-surface-variant)] mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
