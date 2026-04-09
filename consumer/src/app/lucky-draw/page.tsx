"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points: number;
  max_tickets_per_user: number;
  total_tickets: number;
  status: string;
  registration_end: string | null;
  draw_date: string | null;
  prize_count: number;
  ticket_count: number;
}

interface Prize {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  quantity: number;
}

interface Ticket {
  id: string;
  ticket_number: string;
  created_at: string;
}

interface Winner {
  id: string;
  prize_name: string;
  ticket_number: string;
  user_id: string;
}

export default function LuckyDrawPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [registering, setRegistering] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Campaign[] }>("/api/v1/public/lucky-draw");
      setCampaigns(res.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (c: Campaign) => {
    setSelected(c);
    try {
      const [detail, winnersRes] = await Promise.all([
        api.get<{ campaign: Campaign; prizes: Prize[] }>(`/api/v1/public/lucky-draw/${c.id}`),
        api.get<{ data: Winner[] }>(`/api/v1/public/lucky-draw/${c.id}/winners`),
      ]);
      setPrizes(detail.prizes || []);
      setWinners(winnersRes.data || []);

      if (loggedIn) {
        const ticketRes = await api.get<{ data: Ticket[] }>(`/api/v1/my/lucky-draw/${c.id}/tickets`);
        setTickets(ticketRes.data || []);
      }
    } catch {
      /* ignore */
    }
  };

  const handleRegister = async () => {
    if (!selected || !loggedIn) return;
    if (selected.cost_points > 0 && !confirm(`Use ${selected.cost_points} points for a ticket?`)) return;
    setRegistering(true);
    try {
      await api.post(`/api/v1/my/lucky-draw/${selected.id}/register`, {});
      loadDetail(selected);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setRegistering(false);
    }
  };

  if (selected) {
    const canRegister = selected.status === "active" && tickets.length < selected.max_tickets_per_user;

    return (
      <div className="pb-20">
        <Navbar />
        <div className="bg-white sticky top-0 z-10 border-b border-[var(--outline-variant)]">
          <div className="max-w-[480px] mx-auto flex items-center h-14 px-4 gap-3">
            <button onClick={() => { setSelected(null); setPrizes([]); setTickets([]); setWinners([]); }} className="text-[var(--on-surface)]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
            <h1 className="text-[16px] font-medium text-[var(--on-surface)] truncate">{selected.title}</h1>
          </div>
        </div>

        <div className="max-w-[480px] mx-auto px-5 py-5 space-y-5">
          {selected.image_url && (
            <img src={selected.image_url} alt="" className="w-full rounded-[var(--radius-lg)] object-cover max-h-[200px]" />
          )}

          <div>
            <h2 className="text-[20px] font-semibold text-[var(--on-surface)]">{selected.title}</h2>
            {selected.description && (
              <p className="text-[14px] text-[var(--on-surface-variant)] mt-2 whitespace-pre-wrap">{selected.description}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-3 text-center">
              <p className="text-[20px] font-bold text-[var(--primary)]">{selected.cost_points}</p>
              <p className="text-[11px] text-[var(--on-surface-variant)]">pts/ticket</p>
            </div>
            <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-3 text-center">
              <p className="text-[20px] font-bold text-[var(--on-surface)]">
                {selected.ticket_count ?? 0}
                {selected.total_tickets > 0 ? `/${selected.total_tickets}` : ""}
              </p>
              <p className="text-[11px] text-[var(--on-surface-variant)]">tickets</p>
            </div>
            <div className="bg-white rounded-[var(--radius-lg)] elevation-1 p-3 text-center">
              <p className="text-[20px] font-bold text-[var(--on-surface)]">{selected.prize_count}</p>
              <p className="text-[11px] text-[var(--on-surface-variant)]">prizes</p>
            </div>
          </div>

          {selected.draw_date && (
            <div className="bg-[var(--warning-light)] rounded-[var(--radius-lg)] p-3 text-center">
              <p className="text-[12px] text-[var(--warning)]">Draw Date</p>
              <p className="text-[14px] font-semibold text-[var(--on-surface)]">{new Date(selected.draw_date).toLocaleString()}</p>
            </div>
          )}

          {prizes.length > 0 && (
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--on-surface)] mb-3">Prizes</h3>
              <div className="space-y-2">
                {prizes.map((p, i) => (
                  <div key={p.id} className="bg-white rounded-[var(--radius-lg)] elevation-1 p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[14px] font-bold text-[var(--primary)]">#{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[var(--on-surface)]">{p.name}</p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">x{p.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loggedIn && tickets.length > 0 && (
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--on-surface)] mb-3">Your Tickets</h3>
              <div className="space-y-2">
                {tickets.map((t) => (
                  <div key={t.id} className="bg-white rounded-[var(--radius-lg)] elevation-1 p-3 flex items-center justify-between">
                    <span className="font-mono text-[14px] font-bold text-[var(--primary)]">{t.ticket_number}</span>
                    <span className="text-[11px] text-[var(--on-surface-variant)]">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {winners.length > 0 && (
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--on-surface)] mb-3">Winners</h3>
              <div className="space-y-2">
                {winners.map((w) => (
                  <div key={w.id} className="bg-white rounded-[var(--radius-lg)] elevation-1 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-[var(--on-surface)]">{w.prize_name}</p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">Ticket: {w.ticket_number}</p>
                    </div>
                    <span className="text-[11px] text-[var(--success)] font-medium">Winner</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loggedIn && canRegister && (
            <button
              onClick={handleRegister}
              disabled={registering}
              className="w-full h-[48px] bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[15px] font-medium disabled:opacity-50"
            >
              {registering ? "Registering..." : `Get Ticket${selected.cost_points > 0 ? ` (${selected.cost_points} pts)` : ""}`}
            </button>
          )}

          {!loggedIn && (
            <Link
              href="/login"
              className="block w-full h-[48px] leading-[48px] text-center bg-[var(--primary)] text-white rounded-[var(--radius-xl)] text-[15px] font-medium"
            >
              Login to Participate
            </Link>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <Navbar />
      <div className="bg-white sticky top-0 z-10 border-b border-[var(--outline-variant)]">
        <div className="max-w-[480px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link href="/" className="text-[var(--on-surface)]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </Link>
          <h1 className="text-[18px] font-semibold text-[var(--on-surface)]">Lucky Draw</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-6 h-6 text-[var(--primary)]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="max-w-[480px] mx-auto text-center py-16 text-[var(--on-surface-variant)]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30">
            <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
          </svg>
          <p className="text-[14px]">No active lucky draws</p>
        </div>
      ) : (
        <div className="max-w-[480px] mx-auto px-5 py-4 space-y-3">
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => loadDetail(c)}
              className="w-full bg-white rounded-[var(--radius-lg)] elevation-1 overflow-hidden text-left"
            >
              {c.image_url && (
                <img src={c.image_url} alt="" className="w-full h-[150px] object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[16px] font-semibold text-[var(--on-surface)]">{c.title}</h3>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${
                    c.status === "active" ? "bg-[var(--success-light)] text-[var(--success)]"
                    : c.status === "announced" ? "bg-purple-100 text-purple-600"
                    : "bg-gray-100 text-gray-500"
                  }`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[12px] text-[var(--on-surface-variant)]">
                  <span>{c.cost_points} pts/ticket</span>
                  <span>
                    {c.ticket_count ?? 0}
                    {c.total_tickets > 0 ? `/${c.total_tickets}` : ""} joined
                  </span>
                  <span>{c.prize_count} prizes</span>
                </div>
                {c.draw_date && (
                  <p className="text-[11px] text-[var(--warning)] mt-2">
                    Draw: {new Date(c.draw_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
