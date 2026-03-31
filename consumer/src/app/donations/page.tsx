"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

interface Donation {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_points: number;
  collected_points: number;
  status: string;
  donor_count: number;
}

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDonations();
  }, []);

  const loadDonations = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Donation[] }>("/api/v1/public/donations");
      setDonations(res.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <Navbar />
      <div className="bg-white sticky top-[56px] z-10 border-b border-[var(--outline-variant)] shadow-sm">
        <div className="max-w-[480px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link href="/" className="text-[var(--on-surface)]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </Link>
          <h1 className="text-[18px] font-semibold text-[var(--on-surface)]">โครงการบริจาคทั้งหมด</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-6 h-6 text-[var(--primary)]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : donations.length === 0 ? (
        <div className="max-w-[480px] mx-auto text-center py-16 text-[var(--on-surface-variant)]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <p className="text-[14px]">ยังไม่มีโครงการบริจาคในขณะนี้</p>
        </div>
      ) : (
        <div className="max-w-[480px] mx-auto px-5 py-4 space-y-3">
          {donations.map((d) => {
            const progress = d.target_points > 0 ? Math.min(100, (d.collected_points / d.target_points) * 100) : 0;
            return (
              <Link
                key={d.id}
                href={`/donations/${d.id}`}
                className="block w-full bg-white rounded-[var(--radius-lg)] shadow-sm border border-gray-100 overflow-hidden text-left"
              >
                {d.image_url ? (
                  <img src={d.image_url.startsWith('http') ? d.image_url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:30400'}/media/${d.image_url}`} alt="" className="w-full h-[140px] object-cover" />
                ) : (
                  <div className="w-full h-[100px] bg-[var(--primary-light)] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="var(--primary)" className="w-12 h-12 opacity-50">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-[18px] font-bold text-[var(--on-surface)] line-clamp-1">{d.title}</h3>
                  <div className="mt-2">
                    <div className="flex justify-between text-[13px] text-[var(--on-surface-variant)] mb-1">
                      <span>สะสมแล้ว {d.collected_points.toLocaleString()} / {d.target_points.toLocaleString()} แต้ม</span>
                      <span>{d.donor_count} ผู้บริจาค</span>
                    </div>
                    <div className="h-1.5 bg-[var(--outline-variant)] rounded-[var(--radius-sm)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)] rounded-[var(--radius-sm)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
