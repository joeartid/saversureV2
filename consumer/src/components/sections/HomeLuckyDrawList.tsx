"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

interface LuckyDraw {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  point_cost: number;
  status: string;
  end_date: string | null;
}

interface Props {
  limit?: number;
  show_end_date?: boolean;
}

function LuckyDrawCard({
  lucky,
  show_end_date,
}: {
  lucky: LuckyDraw;
  show_end_date: boolean;
}) {
  const imgSrc = mediaUrl(lucky.image_url);
  const endDateStr =
    show_end_date && lucky.end_date
      ? new Date(lucky.end_date).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  return (
    <Link href={`/lucky-draws/${lucky.id}`}>
      <div className="jh-card">
        <div className="jh-card-inner">
          <div className="jh-card-img jh-bg-teal">
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc} alt="" className="jh-card-product-img" />
            ) : (
              <div className="jh-card-emoji">🎁</div>
            )}
          </div>

          <div className="jh-card-detail">
            <div className="jh-card-detail-top">
              <div className="jh-card-free-label !bg-amber-100 !text-amber-600 w-fit">
                ลุ้นโชค
              </div>
              <div
                className="jh-card-name line-clamp-2"
                style={{ fontSize: "16px" }}
              >
                {lucky.title}
              </div>
            </div>

            <div className="jh-card-detail-bottom mt-2">
              <div className="w-full text-[13px] text-[var(--on-surface-variant)] mb-2 flex items-center justify-between">
                <div>
                  ใช้{" "}
                  <span className="text-[var(--primary)] font-bold text-[14px]">
                    {(lucky.point_cost || 0).toLocaleString()}
                  </span>{" "}
                  แต้ม/สิทธิ์
                </div>
                {endDateStr && (
                  <span className="text-[11px] text-gray-400">
                    ถึง {endDateStr}
                  </span>
                )}
              </div>

              <div className="jh-card-point-btn !bg-orange-500 hover:!bg-orange-600 shadow-sm border-0 text-white">
                ร่วมสนุก
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function HomeLuckyDrawList({
  limit = 20,
  show_end_date = false,
}: Props) {
  const [luckyDraws, setLuckyDraws] = useState<LuckyDraw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ data: LuckyDraw[] }>("/api/v1/public/lucky-draw")
      .then((d) => setLuckyDraws(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = luckyDraws.slice(0, limit);

  return (
    <div className="jh-rewards-section">
      {loading ? (
        <div className="jh-empty">
          <p className="text-[12px] text-gray-400">กำลังโหลด...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="jh-empty">
          <div className="jh-empty-icon">🎁</div>
          <p>ยังไม่มีกิจกรรมลุ้นโชคในขณะนี้</p>
        </div>
      ) : (
        items.map((l) => (
          <LuckyDrawCard key={l.id} lucky={l} show_end_date={show_end_date} />
        ))
      )}
    </div>
  );
}
