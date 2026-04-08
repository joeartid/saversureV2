"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CarouselItem {
  image_url: string;
  link?: string;
  alt?: string;
}

interface BannerCarouselProps {
  items?: CarouselItem[];
  auto_play?: boolean;
  interval_ms?: number;
}

export default function BannerCarousel({
  items = [],
  auto_play = true,
  interval_ms = 5000,
}: BannerCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const count = items.length;

  const next = useCallback(() => {
    if (count <= 1) return;
    setCurrent((c) => (c + 1) % count);
  }, [count]);

  const goTo = (i: number) => {
    if (count === 0) return;
    setCurrent(((i % count) + count) % count);
  };

  useEffect(() => {
    if (!auto_play || count <= 1 || isDragging) return;
    const timer = setInterval(next, interval_ms);
    return () => clearInterval(timer);
  }, [auto_play, interval_ms, next, count, isDragging]);

  // Pointer drag handlers (touch + mouse)
  const onPointerDown = (e: React.PointerEvent) => {
    if (count <= 1) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || startXRef.current === null) return;
    setDragOffset(e.clientX - startXRef.current);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const width = trackRef.current?.offsetWidth || 1;
    const threshold = width * 0.15; // 15% ของความกว้างคือ swipe สำเร็จ
    if (dragOffset > threshold) {
      setCurrent((c) => (c - 1 + count) % count);
    } else if (dragOffset < -threshold) {
      setCurrent((c) => (c + 1) % count);
    }
    setDragOffset(0);
    setIsDragging(false);
    startXRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  if (!count) return null;

  // คำนวณ transform: base = -current * 100%, บวก drag offset เป็น px
  const basePercent = -current * 100;
  const trackStyle: React.CSSProperties = {
    transform: `translate3d(calc(${basePercent}% + ${dragOffset}px), 0, 0)`,
    transition: isDragging ? "none" : "transform 500ms cubic-bezier(0.22, 0.61, 0.36, 1)",
  };

  return (
    <div className="px-4 mt-4">
      <div
        ref={trackRef}
        className="relative overflow-hidden rounded-2xl shadow-sm select-none touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Track */}
        <div className="flex w-full" style={trackStyle}>
          {items.map((item, i) => {
            const Wrapper = item.link && !isDragging ? "a" : "div";
            const wrapperProps =
              item.link && !isDragging
                ? { href: item.link, target: "_self" as const }
                : {};
            return (
              <div key={i} className="w-full flex-shrink-0">
                <Wrapper {...wrapperProps} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.alt || `Banner ${i + 1}`}
                    draggable={false}
                    className="w-full h-40 sm:h-48 object-cover pointer-events-none"
                  />
                </Wrapper>
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
