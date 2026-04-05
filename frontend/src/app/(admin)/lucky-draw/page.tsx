"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ImageUpload } from "@/components/ui/image-upload";
import toast from "react-hot-toast";

interface LDCampaign {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points: number;
  max_tickets_per_user: number;
  total_tickets: number;
  status: "draft" | "active" | "drawing" | "announced" | "ended";
  registration_start: string | null;
  registration_end: string | null;
  draw_date: string | null;
  created_at: string;
  prize_count: number;
  ticket_count: number;
}

interface Prize {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  quantity: number;
  prize_order: number;
}

interface Winner {
  id: string;
  prize_name: string;
  ticket_number: string;
  user_id: string;
  announced_at: string;
}

const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-[var(--md-surface-container)]", text: "text-[var(--md-on-surface-variant)]", dot: "bg-[var(--md-on-surface-variant)]" },
  active: { bg: "bg-[var(--md-success-light)]", text: "text-[var(--md-success)]", dot: "bg-[var(--md-success)]" },
  drawing: { bg: "bg-[var(--md-primary-light)]", text: "text-[var(--md-primary)]", dot: "bg-[var(--md-primary)]" },
  announced: { bg: "bg-[#ede7f6]", text: "text-[#7c4dff]", dot: "bg-[#7c4dff]" },
  ended: { bg: "bg-[var(--md-surface-container)]", text: "text-[var(--md-on-surface-variant)]", dot: "bg-[var(--md-on-surface-variant)]" },
};

const fieldClass = "w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200";

export default function LuckyDrawPage() {
  const [campaigns, setCampaigns] = useState<LDCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<LDCampaign | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPrizeForm, setShowPrizeForm] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [drawConfirm, setDrawConfirm] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const campaignFormInit = {
    title: "",
    description: "",
    image_url: "",
    cost_points: 100,
    max_tickets_per_user: 1,
    registration_start: "",
    registration_end: "",
    draw_date: "",
  };

  const prizeFormInit = { name: "", description: "", image_url: "", quantity: 1, prize_order: 0 };
  const [campaignForm, setCampaignForm] = useState(campaignFormInit);
  const [prizeForm, setPrizeForm] = useState(prizeFormInit);

  const fetchCampaigns = async () => {
    try {
      const data = await api.get<{ data: LDCampaign[]; total: number }>("/api/v1/lucky-draw");
      setCampaigns(data.data || []);
      setTotal(data.total || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await api.get<{ campaign: LDCampaign; prizes: Prize[] }>(`/api/v1/lucky-draw/${id}`);
      setCampaign(data.campaign);
      setPrizes(data.prizes || []);
      const winnersData = await api.get<{ data: Winner[] }>(`/api/v1/lucky-draw/${id}/winners`).catch(() => ({ data: [] }));
      setWinners(winnersData.data || []);
    } catch {
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else {
      setCampaign(null);
      setPrizes([]);
      setWinners([]);
    }
  }, [selectedId]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...campaignForm,
        description: campaignForm.description || null,
        image_url: campaignForm.image_url || null,
        registration_start: campaignForm.registration_start || null,
        registration_end: campaignForm.registration_end || null,
        draw_date: campaignForm.draw_date || null,
      };
      if (editingId) {
        await api.patch(`/api/v1/lucky-draw/${editingId}`, payload);
      } else {
        await api.post("/api/v1/lucky-draw", payload);
      }
      setShowForm(false);
      setEditingId(null);
      setCampaignForm(campaignFormInit);
      fetchCampaigns();
      if (editingId === selectedId) fetchDetail(selectedId!);
    } catch {
      toast.error("Failed to save campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPrize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await api.post(`/api/v1/lucky-draw/${selectedId}/prizes`, {
        ...prizeForm,
        image_url: prizeForm.image_url || null,
      });
      setShowPrizeForm(false);
      setPrizeForm(prizeFormInit);
      fetchDetail(selectedId);
    } catch {
      toast.error("Failed to add prize");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrize = async (prizeId: string) => {
    if (!selectedId || !confirm("Delete this prize?")) return;
    setActionId(prizeId);
    try {
      await api.delete(`/api/v1/lucky-draw/${selectedId}/prizes/${prizeId}`);
      fetchDetail(selectedId);
    } catch {
      toast.error("Failed to delete prize");
    } finally {
      setActionId(null);
    }
  };

  const handleDraw = async () => {
    if (!selectedId || !confirm("Draw winners now? This action cannot be undone.")) return;
    setDrawing(true);
    setDrawConfirm(false);
    try {
      await api.post(`/api/v1/lucky-draw/${selectedId}/draw`, {});
      fetchDetail(selectedId);
      fetchCampaigns();
    } catch {
      toast.error("Failed to draw winners");
    } finally {
      setDrawing(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm("Activate this campaign?")) return;
    setActionId(id);
    try {
      await api.patch(`/api/v1/lucky-draw/${id}`, { status: "active" });
      fetchCampaigns();
      if (selectedId === id) fetchDetail(id);
    } catch {
      toast.error("Failed to activate");
    } finally {
      setActionId(null);
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm("End this campaign?")) return;
    setActionId(id);
    try {
      await api.patch(`/api/v1/lucky-draw/${id}`, { status: "ended" });
      fetchCampaigns();
      if (selectedId === id) fetchDetail(id);
    } catch {
      toast.error("Failed to end campaign");
    } finally {
      setActionId(null);
    }
  };

  const handleEdit = (c: LDCampaign) => {
    setEditingId(c.id);
    setCampaignForm({
      title: c.title,
      description: c.description || "",
      image_url: c.image_url || "",
      cost_points: c.cost_points,
      max_tickets_per_user: c.max_tickets_per_user,
      registration_start: c.registration_start ? c.registration_start.slice(0, 16) : "",
      registration_end: c.registration_end ? c.registration_end.slice(0, 16) : "",
      draw_date: c.draw_date ? c.draw_date.slice(0, 16) : "",
    });
    setShowForm(true);
  };

  if (selectedId && campaign) {
    const s = statusStyle[campaign.status] || statusStyle.draft;
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => { setSelectedId(null); setShowForm(false); setEditingId(null); setCampaignForm(campaignFormInit); }}
            className="h-[40px] px-4 text-[14px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] hover:bg-[var(--md-surface-container-high)] transition-all duration-200 inline-flex items-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">{campaign.title}</h1>
            <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--md-radius-sm)] text-[12px] font-medium ${s.bg} ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{campaign.status}
              </span>
              {" · "}{campaign.ticket_count} tickets · {campaign.prize_count} prizes
            </p>
          </div>
          {(campaign.status === "draft" || campaign.status === "active") && (
            <button
              onClick={() => handleEdit(campaign)}
              className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all duration-200"
            >
              Edit
            </button>
          )}
        </div>

        {showForm && editingId === selectedId && (
          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
            <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">Edit Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Title</label>
                  <input type="text" value={campaignForm.title} onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })} required className={fieldClass} placeholder="Campaign title" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Cost (points)</label>
                  <input type="number" value={campaignForm.cost_points} onChange={(e) => setCampaignForm({ ...campaignForm, cost_points: parseInt(e.target.value) || 0 })} min={0} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Max Tickets Per User</label>
                  <input type="number" value={campaignForm.max_tickets_per_user} onChange={(e) => setCampaignForm({ ...campaignForm, max_tickets_per_user: parseInt(e.target.value) || 1 })} min={1} className={fieldClass} />
                </div>
                <div className="md:col-span-2">
                  <ImageUpload
                    value={campaignForm.image_url}
                    onChange={(url) => setCampaignForm({ ...campaignForm, image_url: url })}
                    label="รูปภาพ Lucky Draw"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Registration Start</label>
                  <input type="datetime-local" value={campaignForm.registration_start} onChange={(e) => setCampaignForm({ ...campaignForm, registration_start: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Registration End</label>
                  <input type="datetime-local" value={campaignForm.registration_end} onChange={(e) => setCampaignForm({ ...campaignForm, registration_end: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Draw Date</label>
                  <input type="datetime-local" value={campaignForm.draw_date} onChange={(e) => setCampaignForm({ ...campaignForm, draw_date: e.target.value })} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Description</label>
                <textarea value={campaignForm.description} onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })} rows={3} className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none resize-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setCampaignForm(campaignFormInit); }} className="h-[40px] px-6 text-[14px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] hover:bg-[var(--md-surface-container-high)] transition-all duration-200">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium tracking-[0.1px] hover:bg-[var(--md-primary-dark)] disabled:opacity-60 active:scale-[0.98] transition-all duration-200">
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {detailLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading...
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
              <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4 tracking-[0.1px]">Campaign Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px]">Cost</p>
                  <p className="text-[14px] font-medium text-[var(--md-on-surface)]">{campaign.cost_points} pts</p>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px]">Max Tickets/User</p>
                  <p className="text-[14px] font-medium text-[var(--md-on-surface)]">{campaign.max_tickets_per_user}</p>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px]">Draw Date</p>
                  <p className="text-[14px] font-medium text-[var(--md-on-surface)]">{campaign.draw_date ? new Date(campaign.draw_date).toLocaleString() : "—"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-[0.4px]">Total Tickets</p>
                  <p className="text-[14px] font-medium text-[var(--md-primary)]">{campaign.ticket_count}</p>
                </div>
              </div>
              {campaign.description && (
                <div className="text-[14px] text-[var(--md-on-surface-variant)] mt-4 max-h-[200px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: campaign.description }} />
              )}
            </div>

            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] tracking-[0.1px]">Prizes</h2>
                {campaign.status === "draft" && (
                  <button
                    onClick={() => setShowPrizeForm(!showPrizeForm)}
                    className="h-[40px] px-4 text-[14px] font-medium text-[var(--md-primary)] bg-[var(--md-primary-light)] rounded-[var(--md-radius-xl)] hover:opacity-80 transition-all duration-200"
                  >
                    {showPrizeForm ? "Cancel" : "Add Prize"}
                  </button>
                )}
              </div>
              {showPrizeForm && (
                <form onSubmit={handleAddPrize} className="mb-6 p-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Name</label>
                      <input type="text" value={prizeForm.name} onChange={(e) => setPrizeForm({ ...prizeForm, name: e.target.value })} required className={fieldClass} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Quantity</label>
                      <input type="number" value={prizeForm.quantity} onChange={(e) => setPrizeForm({ ...prizeForm, quantity: parseInt(e.target.value) || 1 })} min={1} className={fieldClass} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Description</label>
                      <input type="text" value={prizeForm.description} onChange={(e) => setPrizeForm({ ...prizeForm, description: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Order</label>
                      <input type="number" value={prizeForm.prize_order} onChange={(e) => setPrizeForm({ ...prizeForm, prize_order: parseInt(e.target.value) || 0 })} className={fieldClass} />
                    </div>
                    <div className="md:col-span-2">
                      <ImageUpload
                        value={prizeForm.image_url}
                        onChange={(url) => setPrizeForm({ ...prizeForm, image_url: url })}
                        label="รูปภาพรางวัล"
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={submitting} className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-60 transition-all duration-200">
                    {submitting ? "Adding..." : "Add Prize"}
                  </button>
                </form>
              )}
              {prizes.length === 0 ? (
                <div className="py-12 text-center text-[var(--md-on-surface-variant)]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68A2.99 2.99 0 009 2C7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" /></svg>
                  <p className="text-[14px]">No prizes yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-[var(--md-outline-variant)]">
                        <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Order</th>
                        <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Name</th>
                        <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Quantity</th>
                        {campaign.status === "draft" && <th className="text-right px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {prizes.sort((a, b) => a.prize_order - b.prize_order).map((p) => (
                        <tr key={p.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors duration-150">
                          <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface-variant)]">{p.prize_order}</td>
                          <td className="px-6 py-4 text-[14px] font-medium text-[var(--md-on-surface)]">{p.name}</td>
                          <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface-variant)]">{p.quantity}</td>
                          {campaign.status === "draft" && (
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDeletePrize(p.id)}
                                disabled={actionId === p.id}
                                className="h-[26px] px-2.5 text-[11px] font-medium text-[var(--md-error)] bg-[var(--md-error-light)] rounded-[var(--md-radius-sm)] hover:opacity-80 disabled:opacity-50 transition-all duration-200"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {(campaign.status === "active" || campaign.status === "drawing") && prizes.length > 0 && (
              <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
                <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4 tracking-[0.1px]">Draw</h2>
                {drawConfirm ? (
                  <div className="flex items-center gap-3">
                    <p className="text-[14px] text-[var(--md-on-surface-variant)]">Confirm draw winners?</p>
                    <button onClick={handleDraw} disabled={drawing} className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-60 transition-all duration-200">
                      {drawing ? "Drawing..." : "Confirm Draw"}
                    </button>
                    <button onClick={() => setDrawConfirm(false)} className="h-[40px] px-6 text-[14px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] hover:bg-[var(--md-surface-container-high)] transition-all duration-200">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDrawConfirm(true)}
                    className="h-[48px] px-8 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all duration-200"
                  >
                    Draw Winners
                  </button>
                )}
              </div>
            )}

            {(campaign.status === "announced" || campaign.status === "ended") && (
              <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
                <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] px-6 pt-6 pb-4 tracking-[0.1px]">Winners</h2>
                {winners.length === 0 ? (
                  <div className="px-6 py-12 text-center text-[var(--md-on-surface-variant)]">
                    <p className="text-[14px]">No winners yet</p>
                  </div>
                ) : (
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-[var(--md-outline-variant)]">
                        <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Prize</th>
                        <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Ticket</th>
                        <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">User ID</th>
                        <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Announced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winners.map((w) => (
                        <tr key={w.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors duration-150">
                          <td className="px-6 py-4 text-[14px] font-medium text-[var(--md-on-surface)]">{w.prize_name}</td>
                          <td className="px-6 py-4 text-[14px] font-mono text-[var(--md-on-surface-variant)]">{w.ticket_number}</td>
                          <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface-variant)]">{w.user_id}</td>
                          <td className="px-6 py-4 text-[13px] text-[var(--md-on-surface-variant)]">{new Date(w.announced_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Lucky Draw</h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">Manage lucky draw campaigns</p>
        </div>
        <button
          onClick={() => showForm ? (setShowForm(false), setEditingId(null), setCampaignForm(campaignFormInit)) : setShowForm(true)}
          className="inline-flex items-center gap-2 h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium tracking-[0.1px] hover:bg-[var(--md-primary-dark)] active:scale-[0.98] transition-all duration-200"
        >
          {showForm ? (
            <><svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>Cancel</>
          ) : (
            <><svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>New Campaign</>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
          <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
            {editingId ? "Edit Campaign" : "Create Campaign"}
          </h2>
          <form onSubmit={handleCreateCampaign} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Title</label>
                <input type="text" value={campaignForm.title} onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })} required className={fieldClass} placeholder="Campaign title" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Cost (points)</label>
                <input type="number" value={campaignForm.cost_points} onChange={(e) => setCampaignForm({ ...campaignForm, cost_points: parseInt(e.target.value) || 0 })} min={0} className={fieldClass} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Max Tickets Per User</label>
                <input type="number" value={campaignForm.max_tickets_per_user} onChange={(e) => setCampaignForm({ ...campaignForm, max_tickets_per_user: parseInt(e.target.value) || 1 })} min={1} className={fieldClass} />
              </div>
              <div className="md:col-span-2">
                <ImageUpload
                  value={campaignForm.image_url}
                  onChange={(url) => setCampaignForm({ ...campaignForm, image_url: url })}
                  label="รูปภาพ Lucky Draw"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Registration Start</label>
                <input type="datetime-local" value={campaignForm.registration_start} onChange={(e) => setCampaignForm({ ...campaignForm, registration_start: e.target.value })} className={fieldClass} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Registration End</label>
                <input type="datetime-local" value={campaignForm.registration_end} onChange={(e) => setCampaignForm({ ...campaignForm, registration_end: e.target.value })} className={fieldClass} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Draw Date</label>
                <input type="datetime-local" value={campaignForm.draw_date} onChange={(e) => setCampaignForm({ ...campaignForm, draw_date: e.target.value })} className={fieldClass} />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">Description</label>
              <textarea value={campaignForm.description} onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })} rows={3} className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none resize-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200" />
            </div>
            <button type="submit" disabled={submitting} className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium tracking-[0.1px] hover:bg-[var(--md-primary-dark)] disabled:opacity-60 active:scale-[0.98] transition-all duration-200">
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Create"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Title</th>
              <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Cost (pts)</th>
              <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Tickets</th>
              <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Prizes</th>
              <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Status</th>
              <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Draw Date</th>
              <th className="text-right px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center"><div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]"><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading...</div></td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center"><div className="text-[var(--md-on-surface-variant)]"><svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" /></svg><p className="text-[14px]">No campaigns yet</p></div></td></tr>
            ) : (
              campaigns.map((c) => {
                const s = statusStyle[c.status] || statusStyle.draft;
                return (
                  <tr key={c.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors duration-150">
                    <td className="px-6 py-4 text-[14px] font-medium text-[var(--md-on-surface)]">{c.title}</td>
                    <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface-variant)]">{c.cost_points}</td>
                    <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface-variant)]">{c.ticket_count}</td>
                    <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface-variant)]">{c.prize_count}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--md-radius-sm)] text-[12px] font-medium ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-[var(--md-on-surface-variant)]">{c.draw_date ? new Date(c.draw_date).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setSelectedId(c.id)} className="h-[26px] px-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] hover:bg-[var(--md-surface-container-high)] transition-all duration-200">
                          View
                        </button>
                        {c.status === "draft" && (
                          <button onClick={() => handleActivate(c.id)} disabled={actionId === c.id} className="h-[26px] px-3 text-[12px] font-medium text-white bg-[var(--md-success)] rounded-[var(--md-radius-sm)] hover:opacity-90 disabled:opacity-50 transition-all duration-200">
                            {actionId === c.id ? "..." : "Activate"}
                          </button>
                        )}
                        {(c.status === "active" || c.status === "drawing" || c.status === "announced") && (
                          <button onClick={() => handleEnd(c.id)} disabled={actionId === c.id} className="h-[26px] px-3 text-[12px] font-medium text-[var(--md-error)] bg-[var(--md-error-light)] rounded-[var(--md-radius-sm)] hover:opacity-90 disabled:opacity-50 transition-all duration-200">
                            {actionId === c.id ? "..." : "End"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
