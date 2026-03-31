"use client";

import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { ImageUpload } from "@/components/ui/image-upload";
import toast from "react-hot-toast";

interface NewsItem {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  position: number;
  type: "news" | "banner";
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
}

type TypeFilter = "all" | "news" | "banner";

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const emptyForm = {
    title: "",
    content: "",
    image_url: "",
    link_url: "",
    position: 0,
    type: "news" as "news" | "banner",
  };
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: NewsItem[]; total: number }>("/api/v1/news");
      setItems(data.data || []);
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

  const filteredItems =
    typeFilter === "all"
      ? items
      : items.filter((i) => i.type === typeFilter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/api/v1/news/${editId}`, form);
      } else {
        await api.post("/api/v1/news", form);
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

  const handleEdit = (item: NewsItem) => {
    setForm({
      title: item.title,
      content: item.content || "",
      image_url: item.image_url || "",
      link_url: item.link_url || "",
      position: item.position,
      type: item.type,
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleTogglePublish = async (item: NewsItem) => {
    const newStatus = item.status === "published" ? "draft" : "published";
    setActionId(item.id);
    try {
      await api.patch(`/api/v1/news/${item.id}`, { status: newStatus });
      fetchData();
    } catch {
      toast.error("Failed");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    setActionId(id);
    try {
      await api.delete(`/api/v1/news/${id}`);
      fetchData();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setActionId(null);
    }
  };

  const fieldClass =
    "w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] focus:border-2 transition-all";

  const textareaClass =
    "w-full min-h-[100px] px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none resize-y focus:border-[var(--md-primary)] focus:border-2 transition-all";

  const statusStyle: Record<string, string> = {
    published: "bg-[var(--md-success-light)] text-[var(--md-success)]",
    draft: "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]",
    archived: "bg-[var(--md-error-light)] text-[var(--md-error)]",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
            News & Banner
          </h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            {total} items
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
              New Item
            </>
          )}
        </button>
      </div>

      <div className="flex gap-1 mb-6">
        {(["all", "news", "banner"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`h-[36px] px-4 rounded-[var(--md-radius-sm)] text-[13px] font-medium transition-all ${
              typeFilter === t
                ? "bg-[var(--md-primary)] text-white"
                : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]"
            }`}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-2 p-6 mb-6">
          <h2 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">
            {editId ? "Edit Item" : "New Item"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${fieldClass} col-span-2`}
              required
            />
            <textarea
              placeholder="Content (optional)"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className={`${textareaClass} col-span-2`}
            />
            <div className="col-span-2">
              <ImageUpload
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                label="รูปภาพข่าว"
              />
            </div>
            <input
              type="text"
              placeholder="Link URL (optional)"
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              className={fieldClass}
            />
            <input
              type="number"
              placeholder="Position"
              value={form.position}
              min={0}
              onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })}
              className={fieldClass}
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "news" | "banner" })}
              className={fieldClass}
            >
              <option value="news">News</option>
              <option value="banner">Banner</option>
            </select>
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                className="h-[48px] px-8 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] transition-all"
              >
                {editId ? "Save Changes" : "Create Item"}
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
                Type
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Status
              </th>
              <th className="text-right px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Position
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                Created
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
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]">
                  No items yet
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img
                          src={mediaUrl(item.image_url) || ""}
                          alt={item.title}
                          className="w-9 h-9 rounded-[var(--md-radius-sm)] object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container)] flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px] text-[var(--md-on-surface-variant)]">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <p className="text-[13px] font-medium text-[var(--md-on-surface)]">{item.title}</p>
                        {item.content && (
                          <p className="text-[11px] text-[var(--md-on-surface-variant)] truncate max-w-[200px]">
                            {item.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] capitalize">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${
                        statusStyle[item.status] || statusStyle.draft
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-[14px] font-medium text-[var(--md-on-surface-variant)]">
                    {item.position}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[var(--md-on-surface-variant)]">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => handleEdit(item)}
                        className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-primary)] bg-[var(--md-primary-light)] hover:opacity-80 transition-all"
                      >
                        Edit
                      </button>
                      {item.status !== "archived" && (
                        <button
                          onClick={() => handleTogglePublish(item)}
                          disabled={actionId === item.id}
                          className={`h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] transition-all disabled:opacity-50 ${
                            item.status === "published"
                              ? "text-[var(--md-warning)] bg-[var(--md-warning-light)]"
                              : "text-[var(--md-success)] bg-[var(--md-success-light)]"
                          }`}
                        >
                          {item.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={actionId === item.id}
                        className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-error)] bg-[var(--md-error-light)] hover:opacity-80 transition-all disabled:opacity-50"
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
    </div>
  );
}
