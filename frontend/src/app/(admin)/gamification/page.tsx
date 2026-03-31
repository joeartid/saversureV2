"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, mediaUrl } from "@/lib/api";
import { ImageUpload } from "@/components/ui/image-upload";

interface Mission {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  type: string;
  condition: string;
  reward_type: string;
  reward_points: number;
  reward_currency: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  sort_order: number;
  active: boolean;
  created_at: string;
}

const RARITY_COLORS: Record<string, { bg: string; text: string }> = {
  common: { bg: "#9E9E9E", text: "#ffffff" },
  uncommon: { bg: "#4CAF50", text: "#ffffff" },
  rare: { bg: "#2196F3", text: "#ffffff" },
  epic: { bg: "#9C27B0", text: "#ffffff" },
  legendary: { bg: "#FF9800", text: "#000000" },
};

const fieldClass =
  "w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200";

export default function GamificationPage() {
  const [tab, setTab] = useState<"missions" | "badges">("missions");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [missionForm, setMissionForm] = useState({
    title: "",
    description: "",
    image_url: "",
    type: "count",
    condition: "{}",
    reward_type: "points",
    reward_points: 0,
    reward_currency: "point",
    start_date: "",
    end_date: "",
  });
  const [badgeForm, setBadgeForm] = useState({
    code: "",
    name: "",
    description: "",
    icon_url: "",
    rarity: "common" as Badge["rarity"],
  });
  const [submittingMission, setSubmittingMission] = useState(false);
  const [submittingBadge, setSubmittingBadge] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchMissions = async () => {
    try {
      const data = await api.get<{ data: Mission[] }>("/api/v1/missions");
      setMissions(data.data || []);
    } catch {
      setMissions([]);
    } finally {
      setLoadingMissions(false);
    }
  };

  const fetchBadges = async () => {
    try {
      const data = await api.get<{ data: Badge[] }>("/api/v1/badges");
      setBadges(data.data || []);
    } catch {
      setBadges([]);
    } finally {
      setLoadingBadges(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  useEffect(() => {
    if (tab === "badges") fetchBadges();
  }, [tab]);

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingMission(true);
    try {
      const payload = {
        title: missionForm.title,
        description: missionForm.description || null,
        image_url: missionForm.image_url || null,
        type: missionForm.type,
        condition: missionForm.condition || "{}",
        reward_type: missionForm.reward_type,
        reward_points: missionForm.reward_points,
        reward_currency: missionForm.reward_currency,
        start_date: missionForm.start_date || null,
        end_date: missionForm.end_date || null,
      };

      if (editId) {
        await api.patch(`/api/v1/missions/${editId}`, payload);
      } else {
        await api.post("/api/v1/missions", payload);
      }

      setShowMissionForm(false);
      setEditId(null);
      setMissionForm({
        title: "",
        description: "",
        image_url: "",
        type: "count",
        condition: "{}",
        reward_type: "points",
        reward_points: 0,
        reward_currency: "point",
        start_date: "",
        end_date: "",
      });
      fetchMissions();
    } catch {
      toast.error(editId ? "Failed to update mission" : "Failed to create mission");
    } finally {
      setSubmittingMission(false);
    }
  };

  const handleEditMission = (m: Mission) => {
    setMissionForm({
      title: m.title,
      description: m.description || "",
      image_url: m.image_url || "",
      type: m.type,
      condition: m.condition || "{}",
      reward_type: m.reward_type,
      reward_points: m.reward_points,
      reward_currency: m.reward_currency,
      start_date: m.start_date ? m.start_date.split(/T|\s/)[0] : "",
      end_date: m.end_date ? m.end_date.split(/T|\s/)[0] : "",
    });
    setEditId(m.id);
    setShowMissionForm(true);
  };

  const handleToggleMissionActive = async (id: string, active: boolean) => {
    setActionId(id);
    try {
      await api.patch(`/api/v1/missions/${id}`, { active: !active });
      fetchMissions();
    } catch {
      toast.error("Failed to update mission");
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteMission = async (id: string) => {
    if (!confirm("Delete this mission?")) return;
    setActionId(id);
    try {
      await api.delete(`/api/v1/missions/${id}`);
      fetchMissions();
    } catch {
      toast.error("Failed to delete mission");
    } finally {
      setActionId(null);
    }
  };

  const handleCreateBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBadge(true);
    try {
      const payload = {
        code: badgeForm.code.toUpperCase(),
        name: badgeForm.name,
        description: badgeForm.description || null,
        icon_url: badgeForm.icon_url || null,
        rarity: badgeForm.rarity,
      };

      if (editId) {
        await api.patch(`/api/v1/badges/${editId}`, payload);
      } else {
        await api.post("/api/v1/badges", payload);
      }

      setShowBadgeForm(false);
      setEditId(null);
      setBadgeForm({ code: "", name: "", description: "", icon_url: "", rarity: "common" });
      fetchBadges();
    } catch {
      toast.error(editId ? "Failed to update badge" : "Failed to create badge");
    } finally {
      setSubmittingBadge(false);
    }
  };

  const handleEditBadge = (b: Badge) => {
    setBadgeForm({
      code: b.code,
      name: b.name,
      description: b.description || "",
      icon_url: b.icon_url || "",
      rarity: b.rarity,
    });
    setEditId(b.id);
    setShowBadgeForm(true);
  };

  const handleDeleteBadge = async (id: string) => {
    if (!confirm("Delete this badge?")) return;
    setActionId(id);
    try {
      await api.delete(`/api/v1/badges/${id}`);
      fetchBadges();
    } catch {
      toast.error("Failed to delete badge");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Gamification
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            Manage missions and badges
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab("missions")}
          className={`h-[40px] px-5 rounded-[var(--md-radius-xl)] text-[14px] font-medium transition-all duration-200 ${
            tab === "missions"
              ? "bg-[var(--md-primary)] text-white"
              : "text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)]"
          }`}
        >
          Missions
        </button>
        <button
          onClick={() => setTab("badges")}
          className={`h-[40px] px-5 rounded-[var(--md-radius-xl)] text-[14px] font-medium transition-all duration-200 ${
            tab === "badges"
              ? "bg-[var(--md-primary)] text-white"
              : "text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)]"
          }`}
        >
          Badges
        </button>
      </div>

      {tab === "missions" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                if (showMissionForm) {
                  setShowMissionForm(false);
                  setEditId(null);
                  setMissionForm({
                    title: "",
                    description: "",
                    image_url: "",
                    type: "count",
                    condition: "{}",
                    reward_type: "points",
                    reward_points: 0,
                    reward_currency: "point",
                    start_date: "",
                    end_date: "",
                  });
                } else {
                  setShowMissionForm(true);
                }
              }}
              className="inline-flex items-center gap-2 h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium tracking-[0.1px] hover:bg-[var(--md-primary-dark)] active:scale-[0.98] transition-all duration-200"
            >
              {showMissionForm ? (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                  Add Mission
                </>
              )}
            </button>
          </div>

          {showMissionForm && (
            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
              <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
                {editId ? "Edit Mission" : "Add Mission"}
              </h2>
              <form onSubmit={handleCreateMission} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Title
                    </label>
                    <input
                      type="text"
                      value={missionForm.title}
                      onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
                      required
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Type
                    </label>
                    <select
                      value={missionForm.type}
                      onChange={(e) => setMissionForm({ ...missionForm, type: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="count">count</option>
                      <option value="streak">streak</option>
                      <option value="total_points">total_points</option>
                      <option value="badge">badge</option>
                      <option value="custom">custom</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Description
                    </label>
                    <input
                      type="text"
                      value={missionForm.description}
                      onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ImageUpload
                      value={missionForm.image_url}
                      onChange={(url) => setMissionForm({ ...missionForm, image_url: url })}
                      label="รูปภาพ Mission"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Condition (JSON)
                    </label>
                    <textarea
                      value={missionForm.condition}
                      onChange={(e) => setMissionForm({ ...missionForm, condition: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none resize-none focus:border-[var(--md-primary)] focus:border-2 transition-all duration-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Reward Type
                    </label>
                    <select
                      value={missionForm.reward_type}
                      onChange={(e) => setMissionForm({ ...missionForm, reward_type: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="points">points</option>
                      <option value="badge">badge</option>
                      <option value="both">both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Reward Points
                    </label>
                    <input
                      type="number"
                      value={missionForm.reward_points}
                      onChange={(e) =>
                        setMissionForm({ ...missionForm, reward_points: parseInt(e.target.value) || 0 })
                      }
                      min={0}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Reward Currency
                    </label>
                    <input
                      type="text"
                      value={missionForm.reward_currency}
                      onChange={(e) =>
                        setMissionForm({ ...missionForm, reward_currency: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={missionForm.start_date}
                      onChange={(e) => setMissionForm({ ...missionForm, start_date: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={missionForm.end_date}
                      onChange={(e) => setMissionForm({ ...missionForm, end_date: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submittingMission}
                  className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium tracking-[0.1px] hover:bg-[var(--md-primary-dark)] disabled:opacity-60 active:scale-[0.98] transition-all duration-200"
                >
                  {submittingMission ? "Saving..." : editId ? "Save Changes" : "Create Mission"}
                </button>
              </form>
            </div>
          )}

          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-[var(--md-outline-variant)]">
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Title
                  </th>
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Type
                  </th>
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Reward
                  </th>
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Period
                  </th>
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Active
                  </th>
                  <th className="text-right px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingMissions ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]">
                        <svg
                          className="animate-spin w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : missions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-[var(--md-on-surface-variant)]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-12 h-12 mx-auto mb-3 opacity-30"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        <p className="text-[14px]">No missions yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  missions.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors duration-150"
                    >
                      <td className="px-6 py-4 text-[14px] font-medium text-[var(--md-on-surface)]">
                        {m.title}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-[var(--md-radius-sm)] text-[12px] font-medium bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]">
                          {m.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface-variant)]">
                        {m.reward_points > 0
                          ? `${m.reward_points} ${m.reward_currency}`
                          : m.reward_type}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[var(--md-on-surface-variant)]">
                        {m.start_date && m.end_date
                          ? `${new Date(m.start_date).toLocaleDateString()} – ${new Date(m.end_date).toLocaleDateString()}`
                          : m.start_date
                            ? `From ${new Date(m.start_date).toLocaleDateString()}`
                            : m.end_date
                              ? `Until ${new Date(m.end_date).toLocaleDateString()}`
                              : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleMissionActive(m.id, m.active)}
                          disabled={actionId === m.id}
                          className={`h-[26px] min-w-[60px] px-3 rounded-[var(--md-radius-sm)] text-[12px] font-medium transition-all duration-200 ${
                            m.active
                              ? "bg-[var(--md-primary)] text-white"
                              : "bg-[var(--md-outline-variant)] text-[var(--md-on-surface-variant)]"
                          }`}
                        >
                          {m.active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditMission(m)}
                            disabled={actionId === m.id}
                            className="h-[26px] px-3 text-[12px] font-medium text-[var(--md-primary)] bg-[var(--md-primary-light)] rounded-[var(--md-radius-sm)] hover:opacity-80 transition-all duration-200 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMission(m.id)}
                            disabled={actionId === m.id}
                            className="h-[26px] px-3 text-[12px] font-medium text-[var(--md-error)] bg-[var(--md-error-light)] rounded-[var(--md-radius-sm)] hover:opacity-80 transition-all duration-200 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "badges" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                if (showBadgeForm) {
                  setShowBadgeForm(false);
                  setEditId(null);
                  setBadgeForm({ code: "", name: "", description: "", icon_url: "", rarity: "common" });
                } else {
                  setShowBadgeForm(true);
                }
              }}
              className="inline-flex items-center gap-2 h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium tracking-[0.1px] hover:bg-[var(--md-primary-dark)] active:scale-[0.98] transition-all duration-200"
            >
              {showBadgeForm ? (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                  Add Badge
                </>
              )}
            </button>
          </div>

          {showBadgeForm && (
            <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 p-6 mb-6">
              <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-5 tracking-[0.1px]">
                {editId ? "Edit Badge" : "Add Badge"}
              </h2>
              <form onSubmit={handleCreateBadge} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Code
                    </label>
                    <input
                      type="text"
                      value={badgeForm.code}
                      onChange={(e) =>
                        setBadgeForm({ ...badgeForm, code: e.target.value.toUpperCase() })
                      }
                      required
                      className={fieldClass}
                      placeholder="UPPERCASE"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Name
                    </label>
                    <input
                      type="text"
                      value={badgeForm.name}
                      onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })}
                      required
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Rarity
                    </label>
                    <select
                      value={badgeForm.rarity}
                      onChange={(e) =>
                        setBadgeForm({
                          ...badgeForm,
                          rarity: e.target.value as Badge["rarity"],
                        })
                      }
                      className={fieldClass}
                    >
                      <option value="common">common</option>
                      <option value="uncommon">uncommon</option>
                      <option value="rare">rare</option>
                      <option value="epic">epic</option>
                      <option value="legendary">legendary</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1.5 tracking-[0.4px] uppercase">
                      Description
                    </label>
                    <input
                      type="text"
                      value={badgeForm.description}
                      onChange={(e) =>
                        setBadgeForm({ ...badgeForm, description: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ImageUpload
                      value={badgeForm.icon_url}
                      onChange={(url) =>
                        setBadgeForm({ ...badgeForm, icon_url: url })
                      }
                      label="ไอคอน Badge"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submittingBadge}
                  className="h-[40px] px-6 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium tracking-[0.1px] hover:bg-[var(--md-primary-dark)] disabled:opacity-60 active:scale-[0.98] transition-all duration-200"
                >
                  {submittingBadge ? "Saving..." : editId ? "Save Changes" : "Create Badge"}
                </button>
              </form>
            </div>
          )}

          <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-[var(--md-outline-variant)]">
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Icon
                  </th>
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Code
                  </th>
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Name
                  </th>
                  <th className="text-left px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Rarity
                  </th>
                  <th className="text-right px-6 py-3.5 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingBadges ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center gap-3 text-[var(--md-on-surface-variant)]">
                        <svg
                          className="animate-spin w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : badges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-[var(--md-on-surface-variant)]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-12 h-12 mx-auto mb-3 opacity-30"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <p className="text-[14px]">No badges yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  badges.map((b) => {
                    const rc = RARITY_COLORS[b.rarity] || RARITY_COLORS.common;
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors duration-150"
                      >
                        <td className="px-6 py-4">
                          {b.icon_url ? (
                            <img
                              src={mediaUrl(b.icon_url) || ""}
                              alt=""
                              className="w-10 h-10 rounded-[var(--md-radius-sm)] object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] flex items-center justify-center">
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-[20px] h-[20px] text-[var(--md-on-surface-variant)]"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-[14px] font-medium text-[var(--md-on-surface)]">
                          {b.code}
                        </td>
                        <td className="px-6 py-4 text-[14px] text-[var(--md-on-surface)]">
                          {b.name}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="px-3 py-1 rounded-[var(--md-radius-sm)] text-[12px] font-medium capitalize"
                            style={{ backgroundColor: rc.bg, color: rc.text }}
                          >
                            {b.rarity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditBadge(b)}
                              disabled={actionId === b.id}
                              className="h-[26px] px-3 text-[12px] font-medium text-[var(--md-primary)] bg-[var(--md-primary-light)] rounded-[var(--md-radius-sm)] hover:opacity-80 transition-all duration-200 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBadge(b.id)}
                              disabled={actionId === b.id}
                              className="h-[26px] px-3 text-[12px] font-medium text-[var(--md-error)] bg-[var(--md-error-light)] rounded-[var(--md-radius-sm)] hover:opacity-80 transition-all duration-200 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
