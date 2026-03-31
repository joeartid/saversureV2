"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, mediaUrl } from "@/lib/api";
import { ImageUpload } from "@/components/ui/image-upload";

interface Donation {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_points: number;
  collected_points: number;
  status: "active" | "ended" | "cancelled";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  donor_count: number;
}

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const emptyForm = {
    title: "",
    description: "",
    image_url: "",
    target_points: 1000,
    start_date: "",
    end_date: "",
  };
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Donation[]; total: number }>("/api/v1/donations");
      setDonations(data.data || []);
      setTotal(data.total || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toDatetimeLocal = (s: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/api/v1/donations/${editId}`, {
          ...form,
          target_points: Number(form.target_points),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });
      } else {
        await api.post("/api/v1/donations", {
          ...form,
          target_points: Number(form.target_points),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    }
  };

  const handleEdit = (d: Donation) => {
    setForm({
      title: d.title,
      description: d.description || "",
      image_url: d.image_url || "",
      target_points: d.target_points,
      start_date: toDatetimeLocal(d.start_date),
      end_date: toDatetimeLocal(d.end_date),
    });
    setEditId(d.id);
    setShowForm(true);
  };

  const handleEnd = async (d: Donation) => {
    setActionId(d.id);
    try {
      await api.patch(`/api/v1/donations/${d.id}`, { status: "ended" });
      fetchData();
    } catch {
      toast.error("Failed");
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (d: Donation) => {
    if (!confirm("Cancel this donation?")) return;
    setActionId(d.id);
    try {
      await api.patch(`/api/v1/donations/${d.id}`, { status: "cancelled" });
      fetchData();
    } catch {
      toast.error("Failed");
    } finally {
      setActionId(null);
    }
  };

  const fieldClass =
    "w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";

  const textareaClass =
    "w-full min-h-[80px] px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all resize-y";

  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Donations
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            {total} donations
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditId(null);
              setForm(emptyForm);
            } else {
              setShowForm(true);
            }
          }}
          className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all flex items-center gap-2"
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              New Donation
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-2 p-6 mb-6">
          <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">
            {editId ? "Edit Donation" : "New Donation"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={fieldClass}
              required
            />
            <input
              type="number"
              placeholder="Target points"
              value={form.target_points}
              min={1}
              onChange={(e) => setForm({ ...form, target_points: parseInt(e.target.value) || 1000 })}
              className={fieldClass}
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${textareaClass} col-span-2`}
            />
            <div className="col-span-2">
              <ImageUpload
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                label="รูปภาพโครงการบริจาค"
              />
            </div>
            <input
              type="datetime-local"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className={fieldClass}
            />
            <input
              type="datetime-local"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className={fieldClass}
            />
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                className="h-[48px] px-8 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all"
              >
                {editId ? "Save Changes" : "Create Donation"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Title
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Progress
              </th>
              <th className="text-right px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Donors
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Status
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Start / End
              </th>
              <th className="text-right px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]">
                  <svg className="animate-spin w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </td>
              </tr>
            ) : donations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]">
                  No donations yet
                </td>
              </tr>
            ) : (
              donations.map((d) => {
                const pct = d.target_points > 0 ? Math.min(100, (d.collected_points / d.target_points) * 100) : 0;
                return (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {d.image_url ? (
                          <img
                            src={mediaUrl(d.image_url) || ""}
                            alt={d.title}
                            className="w-9 h-9 rounded-[var(--md-radius-sm)] object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px] text-[var(--md-on-surface-variant)]">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <p className="text-[13px] font-medium text-[var(--md-on-surface)]">{d.title}</p>
                          {d.description && (
                            <p className="text-[11px] text-[var(--md-on-surface-variant)] truncate max-w-[200px]">
                              {d.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2 bg-[var(--md-surface-container)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--md-primary)] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-[var(--md-on-surface-variant)] whitespace-nowrap">
                          {d.collected_points.toLocaleString()} / {d.target_points.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-[14px] font-medium text-[var(--md-on-surface)]">
                      {d.donor_count}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${
                          d.status === "active"
                            ? "bg-[var(--md-success-light)] text-[var(--md-success)]"
                            : d.status === "ended"
                              ? "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]"
                              : "bg-[var(--md-error-light)] text-[var(--md-error)]"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-[var(--md-on-surface-variant)]">
                      {formatDate(d.start_date)} / {formatDate(d.end_date)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleEdit(d)}
                          className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-primary)] bg-[var(--md-primary-light)] hover:opacity-80 transition-all"
                        >
                          Edit
                        </button>
                        {d.status === "active" && (
                          <>
                            <button
                              onClick={() => handleEnd(d)}
                              disabled={actionId === d.id}
                              className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] hover:opacity-80 transition-all disabled:opacity-50"
                            >
                              End
                            </button>
                            <button
                              onClick={() => handleCancel(d)}
                              disabled={actionId === d.id}
                              className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-error)] bg-[var(--md-error-light)] hover:opacity-80 transition-all disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
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
