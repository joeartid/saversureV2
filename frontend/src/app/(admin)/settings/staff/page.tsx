"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface StaffUser {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  factory_id: string | null;
  factory_name: string | null;
  created_at: string;
}

interface Factory {
  id: string;
  name: string;
  factory_type?: string;
}

const roleOptions = [
  { value: "brand_admin", label: "Brand Admin" },
  { value: "brand_staff", label: "Brand Staff" },
  { value: "factory_user", label: "Factory User" },
];

const roleStyle: Record<string, string> = {
  super_admin: "bg-[#fce4ec] text-[#c62828]",
  brand_admin: "bg-[var(--md-primary-light)] text-[var(--md-primary)]",
  brand_staff: "bg-[var(--md-info-light)] text-[var(--md-info)]",
  factory_user: "bg-[#fff3e0] text-[#e65100]",
  viewer: "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]",
};

const fieldClass =
  "w-full h-[44px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";

const labelClass = "block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-1 uppercase tracking-[0.4px]";

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);

  // Edit drawer state
  const [editTarget, setEditTarget] = useState<StaffUser | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    role: "",
    factory_id: "",
    status: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // Reset password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "brand_staff",
    factory_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: StaffUser[]; total: number }>("/api/v1/staff");
      setStaff(data.data || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchFactories = async () => {
    try {
      const data = await api.get<{ data: Factory[] }>("/api/v1/factories");
      setFactories(data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchData();
    fetchFactories();
  }, []);

  const openEdit = (s: StaffUser) => {
    setEditTarget(s);
    setEditForm({
      first_name: s.first_name || "",
      last_name: s.last_name || "",
      phone: s.phone || "",
      role: s.role,
      factory_id: s.factory_id || "",
      status: s.status,
    });
    setEditError("");
    setEditSuccess("");
    setNewPassword("");
    setConfirmPassword("");
    setPwdError("");
    setPwdSuccess("");
    setShowNewPwd(false);
  };

  const closeEdit = () => {
    setEditTarget(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditError("");
    setEditSuccess("");
    try {
      const payload: Record<string, unknown> = {
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        phone: editForm.phone || null,
        status: editForm.status,
      };
      if (editTarget.role !== "super_admin") {
        payload.role = editForm.role;
        payload.factory_id = editForm.role === "factory_user" && editForm.factory_id
          ? editForm.factory_id
          : null;
      }
      await api.patch(`/api/v1/staff/${editTarget.id}`, payload);
      setEditSuccess("บันทึกข้อมูลสำเร็จ");
      fetchData();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (newPassword !== confirmPassword) {
      setPwdError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (newPassword.length < 6) {
      setPwdError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setPwdSaving(true);
    setPwdError("");
    setPwdSuccess("");
    try {
      await api.post(`/api/v1/staff/${editTarget.id}/reset-password`, { new_password: newPassword });
      setPwdSuccess("รีเซ็ตรหัสผ่านสำเร็จ");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setPwdSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        email: inviteForm.email,
        password: inviteForm.password,
        first_name: inviteForm.first_name,
        last_name: inviteForm.last_name,
        role: inviteForm.role,
      };
      if (inviteForm.role === "factory_user" && inviteForm.factory_id) {
        payload.factory_id = inviteForm.factory_id;
      }
      await api.post("/api/v1/staff", payload);
      setShowInviteForm(false);
      setInviteForm({ email: "", password: "", first_name: "", last_name: "", role: "brand_staff", factory_id: "" });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    setActionId(id);
    try {
      await api.patch(`/api/v1/staff/${id}`, { status: newStatus });
      fetchData();
    } catch { alert("Failed to update"); }
    finally { setActionId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ลบ staff คนนี้? ไม่สามารถเรียกคืนได้")) return;
    setActionId(id);
    try {
      await api.delete(`/api/v1/staff/${id}`);
      fetchData();
    } catch { alert("Failed to delete"); }
    finally { setActionId(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            Staff Management
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            {total} staff members
          </p>
        </div>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all flex items-center gap-2"
        >
          {showInviteForm ? "Cancel" : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              Invite Staff
            </>
          )}
        </button>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-2 p-6 mb-6">
          <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">Invite New Staff</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" placeholder="email@example.com" value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                className={fieldClass} required />
            </div>
            <div>
              <label className={labelClass}>Password *</label>
              <input type="password" placeholder="min 6 ตัวอักษร" value={inviteForm.password}
                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                className={fieldClass} required minLength={6} />
            </div>
            <div>
              <label className={labelClass}>First Name</label>
              <input type="text" placeholder="ชื่อ" value={inviteForm.first_name}
                onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input type="text" placeholder="นามสกุล" value={inviteForm.last_name}
                onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Role *</label>
              <select value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value, factory_id: "" })}
                className={fieldClass}>
                {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {inviteForm.role === "factory_user" ? (
              <div>
                <label className={labelClass}>Factory</label>
                <select value={inviteForm.factory_id}
                  onChange={(e) => setInviteForm({ ...inviteForm, factory_id: e.target.value })}
                  className={fieldClass}>
                  <option value="">— เลือกโรงงาน —</option>
                  {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            ) : <div />}
            <button type="submit"
              className="col-span-2 h-[48px] bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all">
              Create Staff
            </button>
          </form>
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              {["Name", "Email / Phone", "Role", "Factory", "Status", "Joined", "Actions"].map((h, i) => (
                <th key={h} className={`px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase ${i === 6 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center">
                  <svg className="animate-spin w-5 h-5 mx-auto text-[var(--md-primary)]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]">No staff members yet</td>
              </tr>
            ) : (
              staff.map((s) => {
                const name = [s.first_name, s.last_name].filter(Boolean).join(" ");
                return (
                  <tr key={s.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors">
                    <td className="px-5 py-3 text-[13px] font-medium text-[var(--md-on-surface)]">
                      {name || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[13px] text-[var(--md-on-surface-variant)]">{s.email || "—"}</p>
                      {s.phone && <p className="text-[11px] text-[var(--md-on-surface-variant)] opacity-70 mt-0.5">{s.phone}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${roleStyle[s.role] || roleStyle.viewer}`}>
                        {s.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-[var(--md-on-surface-variant)]">
                      {s.factory_name || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${
                        s.status === "active"
                          ? "bg-[var(--md-success-light)] text-[var(--md-success)]"
                          : "bg-[var(--md-error-light)] text-[var(--md-error)]"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-[var(--md-on-surface-variant)]">
                      {new Date(s.created_at).toLocaleDateString("th-TH")}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        {/* Edit button - ทุก role ดูได้ */}
                        <button
                          onClick={() => openEdit(s)}
                          className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-primary)] bg-[var(--md-primary-light)] hover:opacity-80 transition-all"
                        >
                          Edit
                        </button>
                        {s.role !== "super_admin" && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(s.id, s.status)}
                              disabled={actionId === s.id}
                              className={`h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] transition-all disabled:opacity-50 ${
                                s.status === "active"
                                  ? "text-[var(--md-warning)] bg-[var(--md-warning-light)]"
                                  : "text-[var(--md-success)] bg-[var(--md-success-light)]"
                              }`}
                            >
                              {s.status === "active" ? "Suspend" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              disabled={actionId === s.id}
                              className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-error)] bg-[var(--md-error-light)] hover:opacity-80 transition-all disabled:opacity-50"
                            >
                              Delete
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

      {/* Edit Drawer Overlay */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeEdit} />

          {/* Drawer */}
          <div className="w-full max-w-[480px] bg-[var(--md-surface)] h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--md-outline-variant)] sticky top-0 bg-[var(--md-surface)] z-10">
              <div>
                <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Edit Staff</h2>
                <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-0.5">{editTarget.email}</p>
              </div>
              <button onClick={closeEdit} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--md-surface-variant)] transition-all">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--md-on-surface-variant)]">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 p-6 space-y-6">
              {/* Profile Info Section */}
              <div>
                <h3 className="text-[13px] font-semibold text-[var(--md-on-surface-variant)] uppercase tracking-[0.6px] mb-4 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  ข้อมูลส่วนตัว
                </h3>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>First Name</label>
                      <input type="text" placeholder="ชื่อ" value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Last Name</label>
                      <input type="text" placeholder="นามสกุล" value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        className={fieldClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={editTarget.email || ""} disabled
                      className={`${fieldClass} opacity-50 cursor-not-allowed`} />
                    <p className="text-[11px] text-[var(--md-on-surface-variant)] mt-1">Email ไม่สามารถแก้ไขได้</p>
                  </div>

                  <div>
                    <label className={labelClass}>Phone</label>
                    <input type="tel" placeholder="0812345678" value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className={fieldClass} />
                  </div>

                  {/* Role & Factory */}
                  {editTarget.role !== "super_admin" && (
                    <>
                      <div>
                        <label className={labelClass}>Role</label>
                        <select value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value, factory_id: "" })}
                          className={fieldClass}>
                          {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>

                      {editForm.role === "factory_user" && (
                        <div>
                          <label className={labelClass}>Factory</label>
                          <select value={editForm.factory_id}
                            onChange={(e) => setEditForm({ ...editForm, factory_id: e.target.value })}
                            className={fieldClass}>
                            <option value="">— ไม่มี —</option>
                            {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className={labelClass}>Status</label>
                        <select value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className={fieldClass}>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </>
                  )}

                  {editError && (
                    <div className="p-3 rounded-[var(--md-radius-sm)] bg-[var(--md-error-light)] text-[13px] text-[var(--md-error)]">
                      {editError}
                    </div>
                  )}
                  {editSuccess && (
                    <div className="p-3 rounded-[var(--md-radius-sm)] bg-[var(--md-success-light)] text-[13px] text-[var(--md-success)]">
                      {editSuccess}
                    </div>
                  )}

                  <button type="submit" disabled={editSaving}
                    className="w-full h-[44px] bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-50 transition-all">
                    {editSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                  </button>
                </form>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--md-outline-variant)]" />

              {/* Reset Password Section */}
              {editTarget.role !== "super_admin" && (
                <div>
                  <h3 className="text-[13px] font-semibold text-[var(--md-on-surface-variant)] uppercase tracking-[0.6px] mb-4 flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                    Reset Password
                  </h3>
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <div>
                      <label className={labelClass}>รหัสผ่านใหม่</label>
                      <div className="relative">
                        <input
                          type={showNewPwd ? "text" : "password"}
                          placeholder="min 6 ตัวอักษร"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={`${fieldClass} pr-10`}
                          minLength={6}
                        />
                        <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)]">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            {showNewPwd
                              ? <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                              : <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                            }
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>ยืนยันรหัสผ่าน</label>
                      <input
                        type={showNewPwd ? "text" : "password"}
                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    {pwdError && (
                      <div className="p-3 rounded-[var(--md-radius-sm)] bg-[var(--md-error-light)] text-[13px] text-[var(--md-error)]">
                        {pwdError}
                      </div>
                    )}
                    {pwdSuccess && (
                      <div className="p-3 rounded-[var(--md-radius-sm)] bg-[var(--md-success-light)] text-[13px] text-[var(--md-success)]">
                        {pwdSuccess}
                      </div>
                    )}

                    <button type="submit" disabled={pwdSaving || !newPassword}
                      className="w-full h-[44px] border-2 border-[var(--md-error)] text-[var(--md-error)] rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-error-light)] disabled:opacity-40 transition-all">
                      {pwdSaving ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
