"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Customer {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status: string;
  province: string | null;
  occupation: string | null;
  customer_flag: string;
  point_balance: number;
  scan_count: number;
  redeem_count: number;
  created_at: string;
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

type CustomerSortKey = "customer" | "province" | "status" | "points" | "scans" | "redeems" | "joined";
type SortDir = "asc" | "desc";

const statusStyle: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-[var(--md-success-light)]", text: "text-[var(--md-success)]" },
  suspended: { bg: "bg-[var(--md-warning-light)]", text: "text-[var(--md-warning)]" },
  banned: { bg: "bg-[var(--md-error-light)]", text: "text-[var(--md-error)]" },
};

const flagEmoji: Record<string, string> = {
  green: "🟢", yellow: "🟡", orange: "🟠", black: "⚫", gray: "⚪", white: "⚪",
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<CustomerSortKey>("joined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const limit = 30;

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (search) params.set("search", search);
      const data = await api.get<{ data: Customer[]; total: number }>(`/api/v1/customers?${params}`);
      setCustomers(data.data || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!confirm(`${status === "banned" ? "Ban" : status === "suspended" ? "Suspend" : "Activate"} this customer?`)) return;
    setActionId(id);
    try {
      await api.patch(`/api/v1/customers/${id}`, { status });
      fetchData();
    } catch { toast.error("Failed to update"); } finally { setActionId(null); }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const handleSort = (key: CustomerSortKey) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDir(key === "customer" || key === "province" || key === "status" ? "asc" : "desc");
  };
  const sortedCustomers = useMemo(() => {
    const rows = [...customers];
    rows.sort((a, b) => {
      const aName = ([a.first_name, a.last_name].filter(Boolean).join(" ") || a.display_name || a.email || a.phone || "").toLocaleLowerCase();
      const bName = ([b.first_name, b.last_name].filter(Boolean).join(" ") || b.display_name || b.email || b.phone || "").toLocaleLowerCase();
      const compareText = (left: string, right: string) => sortDir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      const compareNumber = (left: number, right: number) => sortDir === "asc" ? left - right : right - left;
      switch (sortBy) {
        case "customer":
          return compareText(aName, bName);
        case "province":
          return compareText((a.province || "").toLocaleLowerCase(), (b.province || "").toLocaleLowerCase());
        case "status":
          return compareText(a.status, b.status);
        case "points":
          return compareNumber(a.point_balance, b.point_balance);
        case "scans":
          return compareNumber(a.scan_count, b.scan_count);
        case "redeems":
          return compareNumber(a.redeem_count, b.redeem_count);
        case "joined":
        default:
          return compareNumber(new Date(a.created_at).getTime(), new Date(b.created_at).getTime());
      }
    });
    return rows;
  }, [customers, sortBy, sortDir]);
  const sortIcon = (key: CustomerSortKey) => {
    if (sortBy !== key) return <span className="ml-1 opacity-30">⇅</span>;
    return <span className="ml-1 text-[var(--md-primary)]">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };
  const SortHeader = ({
    col,
    label,
    className = "",
  }: {
    col: CustomerSortKey;
    label: string;
    className?: string;
  }) => (
    <th className={`px-5 py-3 text-[12px] font-medium uppercase tracking-[0.4px] ${className}`}>
      <button
        type="button"
        onClick={() => handleSort(col)}
        className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
      >
        {label}
        {sortIcon(col)}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Customers</h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">{total.toLocaleString()} registered users</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search email, name, phone..."
            className="h-[40px] w-[260px] px-4 border border-[var(--md-outline-variant)] rounded-[var(--md-radius-xl)] text-[13px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] transition-all"
          />
          <button type="submit" className="h-[40px] px-4 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[13px] font-medium hover:bg-[var(--md-primary-dark)] transition-all">
            Search
          </button>
        </form>
      </div>

      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] md-elevation-1 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--md-outline-variant)]">
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">
                <button type="button" onClick={() => handleSort("customer")} className="inline-flex items-center hover:text-[var(--md-on-surface)]">
                  Customer {sortIcon("customer")}
                </button>
                <span className="ml-1 font-normal normal-case text-[11px] opacity-80">(คลิกชื่อเพื่อดูประวัติการสแกน/แลกแต้ม)</span>
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Phone</th>
              <SortHeader col="province" label="จังหวัด" className="text-left" />
              <th className="text-center px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Flag</th>
              <SortHeader col="status" label="Status" className="text-left" />
              <SortHeader col="points" label="Points" className="text-right" />
              <SortHeader col="scans" label="Scans" className="text-right" />
              <SortHeader col="redeems" label="Redeems" className="text-right" />
              <SortHeader col="joined" label="Joined" className="text-left" />
              <th className="text-right px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] tracking-[0.4px] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]"><svg className="animate-spin w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={10} className="px-5 py-12 text-center text-[var(--md-on-surface-variant)]">No customers found</td></tr>
            ) : sortedCustomers.map((c) => {
              const s = statusStyle[c.status] || statusStyle.active;
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.display_name;
              return (
                <tr
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/customers/${c.id}`)}
                  className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/customers/${c.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/customers/${c.id}`);
                        }
                      }}
                      role="link"
                      tabIndex={0}
                    >
                      {c.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt={name || ""}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[var(--md-surface-container)] flex items-center justify-center text-[12px] font-medium text-[var(--md-on-surface-variant)] flex-shrink-0">
                          {(name || "?").charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-[13px] font-medium text-[var(--md-primary)] hover:underline">{name || "—"}</p>
                        <p className="text-[11px] text-[var(--md-on-surface-variant)]">{c.email || "—"}</p>
                        {c.tags?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                style={{ backgroundColor: tag.color || "#6366f1" }}
                              >
                                {tag.name}
                              </span>
                            ))}
                            {c.tags.length > 3 && (
                              <span className="text-[10px] text-[var(--md-on-surface-variant)]">+{c.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[var(--md-on-surface-variant)]">{c.phone || "—"}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--md-on-surface-variant)]">{c.province || "—"}</td>
                  <td className="px-5 py-3 text-center" title={c.customer_flag}>{flagEmoji[c.customer_flag] || "⚪"}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${s.bg} ${s.text}`}>{c.status}</span></td>
                  <td className="px-5 py-3 text-right text-[14px] font-bold text-[var(--md-primary)]">{c.point_balance.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-[13px] text-[var(--md-on-surface)]">{c.scan_count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-[13px] text-[var(--md-on-surface)]">{c.redeem_count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--md-on-surface-variant)] whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
                    <br />
                    <span className="text-[11px] opacity-70">{new Date(c.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/customers/${c.id}`}
                        className="h-[26px] px-2.5 text-[11px] font-medium rounded-[6px] text-[var(--md-primary)] bg-[var(--md-primary-light)] hover:opacity-80 transition-all inline-flex items-center"
                      >
                        View
                      </Link>
                      {c.status === "active" && (
                        <button onClick={() => handleUpdateStatus(c.id, "suspended")} disabled={actionId === c.id} className="h-[26px] px-2.5 text-[11px] font-medium text-[var(--md-warning)] bg-[var(--md-warning-light)] rounded-[6px] disabled:opacity-50 hover:opacity-80 transition-all">
                          Suspend
                        </button>
                      )}
                      {c.status === "suspended" && (
                        <button onClick={() => handleUpdateStatus(c.id, "active")} disabled={actionId === c.id} className="h-[26px] px-2.5 text-[11px] font-medium text-[var(--md-success)] bg-[var(--md-success-light)] rounded-[6px] disabled:opacity-50 hover:opacity-80 transition-all">
                          Activate
                        </button>
                      )}
                      {c.status !== "banned" && (
                        <button onClick={() => handleUpdateStatus(c.id, "banned")} disabled={actionId === c.id} className="h-[26px] px-2.5 text-[11px] font-medium text-[var(--md-error)] bg-[var(--md-error-light)] rounded-[6px] disabled:opacity-50 hover:opacity-80 transition-all">
                          Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--md-outline-variant)]">
            <p className="text-[12px] text-[var(--md-on-surface-variant)]">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-1.5">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-[30px] px-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] disabled:opacity-40 hover:bg-[var(--md-surface-container-high)] transition-all">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-[30px] px-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-sm)] disabled:opacity-40 hover:bg-[var(--md-surface-container-high)] transition-all">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
