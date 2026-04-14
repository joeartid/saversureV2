"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface CustomerDetail {
  profile: {
    id: string;
    email: string;
    phone?: string;
    display_name: string;
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    gender?: string;
    avatar_url?: string;
    province?: string;
    occupation?: string;
    customer_flag: string;
    phone_verified: boolean;
    status: string;
    created_at: string;
    last_login_at?: string;
    admin_notes?: string;
  };
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  balance: number;
  scan_history: Array<{
    id: string;
    campaign_id: string;
    points_earned: number;
    scanned_at: string;
    scan_type: string;
    latitude?: number;
    longitude?: number;
    province?: string;
    district?: string;
    sub_district?: string;
    postal_code?: string;
    product_name?: string;
    product_sku?: string;
    product_image_url?: string;
    legacy_serial?: string;
    legacy_product_name?: string;
    legacy_product_sku?: string;
    legacy_product_image_url?: string;
    legacy_status?: number;
    data_source: string;
  }>;
  point_ledger: Array<{
    id: string;
    type: string;
    amount: number;
    source: string;
    description: string;
    created_at: string;
  }>;
  redemptions: Array<{
    id: string;
    status: string;
    created_at: string;
    reward_name: string;
    reward_image_url?: string;
    point_cost: number;
  }>;
  addresses: Array<{
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    address_line1: string;
    province?: string;
    postal_code?: string;
    is_default: boolean;
  }>;
}

interface CustomerTag {
  id: string;
  name: string;
  color: string;
}

interface UserSearchResult {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  line_user_id: string;
  line_display_name: string;
}

const statusBadgeStyle: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-100", text: "text-green-700" },
  suspended: { bg: "bg-red-100", text: "text-red-700" },
  confirmed: { bg: "bg-blue-100", text: "text-blue-700" },
  pending: { bg: "bg-orange-100", text: "text-orange-700" },
};

const flagLabels: Record<string, { emoji: string; label: string; color: string }> = {
  green: { emoji: "🟢", label: "ปกติ", color: "text-green-600" },
  yellow: { emoji: "🟡", label: "สงสัย", color: "text-yellow-600" },
  orange: { emoji: "🟠", label: "เฝ้าระวัง", color: "text-orange-600" },
  black: { emoji: "⚫", label: "บล็อก", color: "text-gray-900" },
  gray: { emoji: "⚪", label: "ไม่ระบุ", color: "text-gray-500" },
  white: { emoji: "⚪", label: "ใหม่", color: "text-gray-400" },
};

const genderLabels: Record<string, string> = {
  male: "ชาย",
  female: "หญิง",
  other: "อื่นๆ",
};

function StatusBadge({ status }: { status: string }) {
  const s = statusBadgeStyle[status] || statusBadgeStyle.pending;
  return (
    <span className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}

function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `/media/${url}`;
}

function googleMapsUrl(opts: {
  latitude?: number;
  longitude?: number;
  province?: string | null;
  district?: string | null;
  subDistrict?: string | null;
}): string | null {
  if (opts.latitude != null && opts.longitude != null) {
    return `https://www.google.com/maps?q=${opts.latitude},${opts.longitude}`;
  }

  const query = [opts.subDistrict, opts.district, opts.province]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

type DetailTab = "ledger" | "scans" | "redemptions";
type SortDir = "asc" | "desc";
type LedgerSortKey = "type" | "amount" | "source" | "description" | "created_at";
type ScanSortKey = "legacy_serial" | "product_name" | "scan_type" | "points_earned" | "scanned_at" | "location";
type RedemptionSortKey = "reward_name" | "point_cost" | "status" | "created_at";

function compareText(a?: string | null, b?: string | null, dir: SortDir = "asc"): number {
  const left = (a || "").toLocaleLowerCase();
  const right = (b || "").toLocaleLowerCase();
  if (left === right) return 0;
  return dir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
}

function compareNumber(a: number, b: number, dir: SortDir = "asc"): number {
  return dir === "asc" ? a - b : b - a;
}

function compareDate(a?: string | null, b?: string | null, dir: SortDir = "asc"): number {
  const left = a ? new Date(a).getTime() : 0;
  const right = b ? new Date(b).getTime() : 0;
  return compareNumber(left, right, dir);
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const [transferModal, setTransferModal] = useState(false);
  const [mergeModal, setMergeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [allTags, setAllTags] = useState<CustomerTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [crmSaving, setCrmSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("scans");
  const [ledgerSort, setLedgerSort] = useState<{ key: LedgerSortKey; dir: SortDir }>({ key: "created_at", dir: "desc" });
  const [scanSort, setScanSort] = useState<{ key: ScanSortKey; dir: SortDir }>({ key: "scanned_at", dir: "desc" });
  const [redemptionSort, setRedemptionSort] = useState<{ key: RedemptionSortKey; dir: SortDir }>({ key: "created_at", dir: "desc" });

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [detailRes, tagRes] = await Promise.all([
          api.get<CustomerDetail>(`/api/v1/customers/${id}/detail`),
          api.get<{ data: CustomerTag[] }>("/api/v1/crm/tags"),
        ]);
        setData(detailRes);
        setAllTags(tagRes.data || []);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  useEffect(() => {
    setSelectedTagIds((data?.tags || []).map((tag) => tag.id));
    setNotesDraft(data?.profile.admin_notes || "");
  }, [data]);

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(refundAmount, 10);
    if (!amount || amount <= 0) {
      toast.error("กรุณาระบุจำนวน points ที่ถูกต้อง");
      return;
    }
    setRefundSubmitting(true);
    try {
      await api.post("/api/v1/points/refund", {
        user_id: id,
        amount,
        reason: refundReason || "Admin refund",
      });
      setRefundModal(false);
      setRefundAmount("");
      setRefundReason("");
      const res = await api.get<CustomerDetail>(`/api/v1/customers/${id}/detail`);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Refund failed";
      toast.error(msg);
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get<{ data: UserSearchResult[] }>(
        `/api/v1/customers/search?q=${encodeURIComponent(searchQuery)}`
      );
      setSearchResults((res.data || []).filter((u) => u.id !== id));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleTransferLINE = async () => {
    if (!selectedUser) return;
    if (!confirm(`ย้าย LINE จาก "${selectedUser.line_display_name || selectedUser.display_name}" มายัง account นี้?`)) return;
    setActionSubmitting(true);
    try {
      await api.post(`/api/v1/customers/${id}/transfer-line`, { from_user_id: selectedUser.id });
      toast.success("ย้าย LINE สำเร็จ");
      setTransferModal(false);
      setSelectedUser(null);
      setSearchQuery("");
      const res = await api.get<CustomerDetail>(`/api/v1/customers/${id}/detail`);
      setData(res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedUser) return;
    if (!confirm(`รวม account "${selectedUser.display_name || selectedUser.phone}" เข้ากับ account นี้? (account ที่เลือกจะถูกปิด)`)) return;
    setActionSubmitting(true);
    try {
      await api.post("/api/v1/customers/merge", { keep_user_id: id, remove_user_id: selectedUser.id });
      toast.success("Merge สำเร็จ");
      setMergeModal(false);
      setSelectedUser(null);
      setSearchQuery("");
      const res = await api.get<CustomerDetail>(`/api/v1/customers/${id}/detail`);
      setData(res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleToggleTag = (tagID: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagID) ? prev.filter((id) => id !== tagID) : [...prev, tagID]));
  };

  const handleSaveCRM = async () => {
    setCrmSaving(true);
    try {
      await Promise.all([
        api.put(`/api/v1/crm/customers/${id}/tags`, { tag_ids: selectedTagIds }),
        api.patch(`/api/v1/customers/${id}`, { admin_notes: notesDraft }),
      ]);
      const res = await api.get<CustomerDetail>(`/api/v1/customers/${id}/detail`);
      setData(res);
      toast.success("บันทึก CRM profile แล้ว");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "บันทึก CRM profile ไม่สำเร็จ");
    } finally {
      setCrmSaving(false);
    }
  };

  const scan_history = data?.scan_history || [];
  const point_ledger = data?.point_ledger || [];
  const redemptions = data?.redemptions || [];
  const addresses = data?.addresses || [];
  const totalEarned = point_ledger.filter((l) => l.type === "credit").reduce((s, l) => s + l.amount, 0);
  const totalSpent = point_ledger.filter((l) => l.type === "debit").reduce((s, l) => s + l.amount, 0);
  const successScans = scan_history.filter((s) => s.scan_type === "success").length;
  const totalScans = scan_history.length;
  const v1Scans = scan_history.filter((s) => s.data_source === "v1").length;
  const tabItems: Array<{ id: DetailTab; label: string; count: number }> = [
    { id: "scans", label: "ประวัติการสแกน", count: scan_history.length },
    { id: "redemptions", label: "ประวัติการแลกแต้ม", count: redemptions.length },
    { id: "ledger", label: "Point Ledger", count: point_ledger.length },
  ];
  const nextSort = <T extends string>(prev: { key: T; dir: SortDir }, key: T): { key: T; dir: SortDir } => ({
    key,
    dir: prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "asc",
  });
  const sortIndicator = (active: boolean, dir: SortDir) => {
    if (!active) return <span className="ml-1 opacity-30">⇅</span>;
    return <span className="ml-1 text-[var(--md-primary)]">{dir === "asc" ? "↑" : "↓"}</span>;
  };
  const sortedPointLedger = useMemo(() => {
    const rows = [...point_ledger];
    rows.sort((a, b) => {
      switch (ledgerSort.key) {
        case "type":
          return compareText(a.type, b.type, ledgerSort.dir);
        case "amount":
          return compareNumber(a.amount, b.amount, ledgerSort.dir);
        case "source":
          return compareText(a.source, b.source, ledgerSort.dir);
        case "description":
          return compareText(a.description, b.description, ledgerSort.dir);
        case "created_at":
        default:
          return compareDate(a.created_at, b.created_at, ledgerSort.dir);
      }
    });
    return rows;
  }, [point_ledger, ledgerSort]);
  const sortedScanHistory = useMemo(() => {
    const rows = [...scan_history];
    rows.sort((a, b) => {
      const aLocation = [a.sub_district, a.district, a.province].filter(Boolean).join(", ");
      const bLocation = [b.sub_district, b.district, b.province].filter(Boolean).join(", ");
      switch (scanSort.key) {
        case "legacy_serial":
          return compareText(a.legacy_serial, b.legacy_serial, scanSort.dir);
        case "product_name":
          return compareText(a.product_name || a.legacy_product_name, b.product_name || b.legacy_product_name, scanSort.dir);
        case "scan_type":
          return compareText(a.scan_type, b.scan_type, scanSort.dir);
        case "points_earned": {
          const left = a.scan_type === "success" ? a.points_earned : 0;
          const right = b.scan_type === "success" ? b.points_earned : 0;
          return compareNumber(left, right, scanSort.dir);
        }
        case "location":
          return compareText(aLocation, bLocation, scanSort.dir);
        case "scanned_at":
        default:
          return compareDate(a.scanned_at, b.scanned_at, scanSort.dir);
      }
    });
    return rows;
  }, [scan_history, scanSort]);
  const sortedRedemptions = useMemo(() => {
    const rows = [...redemptions];
    rows.sort((a, b) => {
      switch (redemptionSort.key) {
        case "reward_name":
          return compareText(a.reward_name, b.reward_name, redemptionSort.dir);
        case "point_cost":
          return compareNumber(a.point_cost, b.point_cost, redemptionSort.dir);
        case "status":
          return compareText(a.status, b.status, redemptionSort.dir);
        case "created_at":
        default:
          return compareDate(a.created_at, b.created_at, redemptionSort.dir);
      }
    });
    return rows;
  }, [redemptions, redemptionSort]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <svg className="animate-spin w-8 h-8 text-[var(--md-primary)]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--md-on-surface-variant)]">ไม่พบข้อมูลลูกค้า</p>
        <Link href="/customers" className="mt-4 inline-block text-[var(--md-primary)] hover:underline">
          กลับไปรายการลูกค้า
        </Link>
      </div>
    );
  }

  const { profile, balance } = data;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-[14px] text-[var(--md-on-surface-variant)] hover:text-[var(--md-primary)] transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        กลับไปรายการลูกค้า
      </Link>

      {/* Profile header */}
      <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] p-6">
        <div className="flex items-start gap-5">
          <div className="flex-shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--md-surface-container)] flex items-center justify-center text-[24px] font-medium text-[var(--md-on-surface-variant)]">
                {profile.display_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[24px] font-medium text-[var(--md-on-surface)]">
                {profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—"}
              </h1>
              <StatusBadge status={profile.status} />
              {profile.phone_verified && (
                <span className="px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium bg-blue-100 text-blue-700">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">{profile.email}</p>
            {profile.phone && (
              <p className="text-[14px] text-[var(--md-on-surface-variant)]">{profile.phone}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-[var(--md-on-surface-variant)]">
              <span>Member since: {new Date(profile.created_at).toLocaleDateString()}</span>
              {profile.last_login_at && (
                <span>Last login: {new Date(profile.last_login_at).toLocaleString()}</span>
              )}
              {profile.province && <span>จังหวัด: {profile.province}</span>}
              {profile.occupation && <span>อาชีพ: {profile.occupation}</span>}
              {profile.gender && <span>เพศ: {genderLabels[profile.gender] || profile.gender}</span>}
              {profile.birth_date && <span>เกิด: {new Date(profile.birth_date).toLocaleDateString()}</span>}
            </div>
            {profile.customer_flag && profile.customer_flag !== "green" && (() => {
              const f = flagLabels[profile.customer_flag] || flagLabels.gray;
              return (
                <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium ${f.color} bg-gray-100 dark:bg-[var(--md-surface-container)]`}>
                  <span>{f.emoji}</span>
                  <span>Flag: {f.label}</span>
                </div>
              );
            })()}
            <div className="mt-4 rounded-[16px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-[var(--md-on-surface)]">CRM Profile</p>
                  <p className="text-[12px] text-[var(--md-on-surface-variant)]">จัด tag และบันทึกหมายเหตุภายในสำหรับทีมงาน</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCRM}
                  disabled={crmSaving}
                  className="h-[36px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[12px] font-medium disabled:opacity-60"
                >
                  {crmSaving ? "Saving..." : "Save CRM"}
                </button>
              </div>
              <div className="mt-3">
                <p className="mb-2 text-[12px] font-medium text-[var(--md-on-surface-variant)]">Tags</p>
                {allTags.length === 0 ? (
                  <p className="text-[12px] text-[var(--md-on-surface-variant)]">ยังไม่มี tag ในระบบ</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const active = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-all ${
                            active ? "border-transparent text-white" : "border-[var(--md-outline-variant)] text-[var(--md-on-surface-variant)]"
                          }`}
                          style={active ? { backgroundColor: tag.color || "#6366f1" } : undefined}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <p className="mb-2 text-[12px] font-medium text-[var(--md-on-surface-variant)]">Admin Notes</p>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="เช่น ลูกค้ารายนี้ชอบโปรสายสุขภาพ / มีประวัติสแกนถี่ / ต้องติดตามเป็นพิเศษ"
                  className="min-h-[96px] w-full rounded-[16px] border border-[var(--md-outline-variant)] bg-transparent px-4 py-3 text-[13px] text-[var(--md-on-surface)] outline-none focus:border-[var(--md-primary)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] p-5">
          <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-wide">คะแนนคงเหลือ</p>
          <p className="text-[28px] font-bold text-[var(--md-primary)] mt-1">{balance.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] p-5">
          <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-wide">ได้รับ / ใช้ไป</p>
          <p className="text-[20px] font-bold text-green-600 mt-1">+{totalEarned.toLocaleString()}</p>
          <p className="text-[14px] font-medium text-red-500">-{totalSpent.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] p-5">
          <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-wide">สแกนทั้งหมด</p>
          <p className="text-[28px] font-bold text-[var(--md-on-surface)] mt-1">{totalScans}</p>
          <p className="text-[12px] text-[var(--md-on-surface-variant)]">สำเร็จ {successScans} ครั้ง</p>
        </div>
        <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] p-5 flex flex-col justify-between">
          <div>
            <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-wide">แหล่งข้อมูล</p>
            <p className="text-[13px] text-[var(--md-on-surface)] mt-1">
              {v1Scans > 0 && <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[11px] font-medium">V1: {v1Scans}</span>}
              {totalScans - v1Scans > 0 && <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-medium">V2: {totalScans - v1Scans}</span>}
              {totalScans === 0 && <span className="text-[var(--md-on-surface-variant)]">—</span>}
            </p>
          </div>
          <button
            onClick={() => setRefundModal(true)}
            className="mt-3 h-[36px] px-4 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[13px] font-medium hover:bg-[var(--md-primary-dark)] transition-all w-full"
          >
            Refund Points
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] overflow-hidden">
        <div className="px-4 pt-4 border-b border-[var(--md-outline-variant)]">
          <div className="flex flex-wrap gap-2">
            {tabItems.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-t-[12px] text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--md-primary)] text-white"
                      : "bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
                  }`}
                >
                  {tab.label} <span className={`ml-1 ${active ? "text-white/80" : "text-[var(--md-on-surface-variant)]"}`}>({tab.count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "ledger" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--md-outline-variant)]">
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setLedgerSort((prev) => nextSort(prev, "type"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      ประเภท{sortIndicator(ledgerSort.key === "type", ledgerSort.dir)}
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setLedgerSort((prev) => nextSort(prev, "amount"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      จำนวน{sortIndicator(ledgerSort.key === "amount", ledgerSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setLedgerSort((prev) => nextSort(prev, "source"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      แหล่งที่มา{sortIndicator(ledgerSort.key === "source", ledgerSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setLedgerSort((prev) => nextSort(prev, "description"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      รายละเอียด{sortIndicator(ledgerSort.key === "description", ledgerSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setLedgerSort((prev) => nextSort(prev, "created_at"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      วันที่{sortIndicator(ledgerSort.key === "created_at", ledgerSort.dir)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {point_ledger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[var(--md-on-surface-variant)]">
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                ) : (
                  sortedPointLedger.map((l) => {
                    const sourceLabels: Record<string, { label: string; cls: string }> = {
                      scan_history: { label: "สแกน QR", cls: "bg-blue-100 text-blue-700" },
                      v1_live_sync_balance: { label: "ยอดจาก V1", cls: "bg-amber-100 text-amber-700" },
                      v1_live_sync_reconcile: { label: "ปรับยอด V1", cls: "bg-orange-100 text-orange-700" },
                      redemption: { label: "แลกของรางวัล", cls: "bg-purple-100 text-purple-700" },
                      refund: { label: "Refund", cls: "bg-red-100 text-red-700" },
                    };
                    const src = sourceLabels[l.source] || { label: l.source || "—", cls: "bg-gray-100 text-gray-600" };
                    const isCredit = l.type === "credit";

                    return (
                      <tr key={l.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${isCredit ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {isCredit ? "รับ" : "ใช้"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold text-[14px] ${isCredit ? "text-green-600" : "text-red-600"}`}>
                          {isCredit ? "+" : "-"}{l.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${src.cls}`}>
                            {src.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--md-on-surface-variant)] max-w-[320px] truncate" title={l.description || ""}>
                          {l.description || "—"}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--md-on-surface-variant)] whitespace-nowrap">
                          {new Date(l.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "scans" && (
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--md-outline-variant)]">
              <h2 className="text-[16px] font-medium text-[var(--md-on-surface)]">
                ประวัติการสแกน <span className="font-normal text-[13px] text-[var(--md-on-surface-variant)]">({scan_history.length} รายการล่าสุด)</span>
              </h2>
              <div className="flex gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">V2</span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">V1</span>
              </div>
            </div>
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-[var(--md-outline-variant)]">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-wide w-[50px]">แหล่ง</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--md-on-surface-variant)] uppercase tracking-wide w-[72px]">รูป</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setScanSort((prev) => nextSort(prev, "legacy_serial"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      รหัส / Serial{sortIndicator(scanSort.key === "legacy_serial", scanSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setScanSort((prev) => nextSort(prev, "product_name"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      สินค้า{sortIndicator(scanSort.key === "product_name", scanSort.dir)}
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setScanSort((prev) => nextSort(prev, "scan_type"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      สถานะ{sortIndicator(scanSort.key === "scan_type", scanSort.dir)}
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setScanSort((prev) => nextSort(prev, "points_earned"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      แต้ม{sortIndicator(scanSort.key === "points_earned", scanSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setScanSort((prev) => nextSort(prev, "scanned_at"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      วันที่{sortIndicator(scanSort.key === "scanned_at", scanSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide">
                    <button type="button" onClick={() => setScanSort((prev) => nextSort(prev, "location"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      พื้นที่{sortIndicator(scanSort.key === "location", scanSort.dir)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {scan_history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[var(--md-on-surface-variant)]">
                      ยังไม่มีประวัติการสแกน
                    </td>
                  </tr>
                ) : (
                  sortedScanHistory.map((s) => {
                    const isV1 = s.data_source === "v1";
                    const displayPoints = s.scan_type === "success" ? s.points_earned : 0;
                    const scanTypeLabel: Record<string, { label: string; cls: string }> = {
                      success: { label: "สำเร็จ", cls: "bg-green-100 text-green-700" },
                      duplicate_self: { label: "ซ้ำ (ตัวเอง)", cls: "bg-yellow-100 text-yellow-700" },
                      duplicate_other: { label: "ซ้ำ (คนอื่น)", cls: "bg-red-100 text-red-700" },
                    };
                    const st = scanTypeLabel[s.scan_type] || { label: s.scan_type, cls: "bg-gray-100 text-gray-600" };
                    const imageSrc = mediaUrl(s.product_image_url || s.legacy_product_image_url);
                    const productName = s.product_name || s.legacy_product_name;
                    const productSku = s.product_sku || s.legacy_product_sku;
                    const locationParts = [s.sub_district, s.district, s.province].filter(Boolean);
                    const locationText = locationParts.length > 0
                      ? locationParts.join(", ")
                      : s.latitude != null && s.longitude != null
                        ? `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`
                        : "—";
                    const mapUrl = googleMapsUrl({
                      latitude: s.latitude,
                      longitude: s.longitude,
                      province: s.province,
                      district: s.district,
                      subDistrict: s.sub_district,
                    });

                    return (
                      <tr key={s.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${isV1 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {isV1 ? "V1" : "V2"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {imageSrc ? (
                            <img src={imageSrc} alt={productName || "product"} className="w-11 h-11 rounded-[10px] object-cover border border-[var(--md-outline-variant)]" />
                          ) : (
                            <div className="w-11 h-11 rounded-[10px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container)] flex items-center justify-center text-[18px]">
                              🏷️
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.legacy_serial ? (
                            <Link
                              href={`/scan-history?legacy_serial=${encodeURIComponent(s.legacy_serial)}`}
                              className="font-mono text-[13px] font-medium text-[var(--md-primary)] hover:underline"
                              title="ดูว่าใครเคยสแกนรหัสนี้บ้าง"
                            >
                              {s.legacy_serial}
                            </Link>
                          ) : (
                            <span className="text-[12px] text-[var(--md-on-surface-variant)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {productName ? (
                            <div>
                              <div className="text-[13px] text-[var(--md-on-surface)] leading-tight">{productName}</div>
                              {productSku && (
                                <div className="text-[11px] text-[var(--md-on-surface-variant)] mt-0.5">SKU: {productSku}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-[var(--md-on-surface-variant)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold text-[14px] ${displayPoints > 0 ? "text-[var(--md-primary)]" : "text-[var(--md-on-surface-variant)]"}`}>
                            {displayPoints > 0 ? `+${displayPoints}` : displayPoints}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--md-on-surface-variant)] whitespace-nowrap">
                          {new Date(s.scanned_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
                          <br />
                          <span className="text-[11px] opacity-70">{new Date(s.scanned_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--md-on-surface-variant)] max-w-[180px] truncate" title={locationText}>
                          {mapUrl ? (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[var(--md-primary)] hover:underline"
                              title="เปิดตำแหน่งใน Google Maps"
                            >
                              <span className="truncate">{locationText}</span>
                              <span className="text-[11px]">↗</span>
                            </a>
                          ) : (
                            locationText
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "redemptions" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-[var(--md-outline-variant)]">
                  <th className="text-left px-5 py-3 text-[12px] font-medium text-[var(--md-on-surface-variant)] uppercase">รูป</th>
                  <th className="text-left px-5 py-3 text-[12px] font-medium uppercase">
                    <button type="button" onClick={() => setRedemptionSort((prev) => nextSort(prev, "reward_name"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      Reward{sortIndicator(redemptionSort.key === "reward_name", redemptionSort.dir)}
                    </button>
                  </th>
                  <th className="text-right px-5 py-3 text-[12px] font-medium uppercase">
                    <button type="button" onClick={() => setRedemptionSort((prev) => nextSort(prev, "point_cost"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      Points{sortIndicator(redemptionSort.key === "point_cost", redemptionSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-5 py-3 text-[12px] font-medium uppercase">
                    <button type="button" onClick={() => setRedemptionSort((prev) => nextSort(prev, "status"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      Status{sortIndicator(redemptionSort.key === "status", redemptionSort.dir)}
                    </button>
                  </th>
                  <th className="text-left px-5 py-3 text-[12px] font-medium uppercase">
                    <button type="button" onClick={() => setRedemptionSort((prev) => nextSort(prev, "created_at"))} className="inline-flex items-center text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]">
                      Date{sortIndicator(redemptionSort.key === "created_at", redemptionSort.dir)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {redemptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[var(--md-on-surface-variant)]">
                      ยังไม่มีประวัติการแลกแต้ม
                    </td>
                  </tr>
                ) : (
                  sortedRedemptions.map((r) => {
                    const rewardImage = mediaUrl(r.reward_image_url);
                    return (
                      <tr key={r.id} className="border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)]">
                        <td className="px-5 py-3">
                          {rewardImage ? (
                            <img src={rewardImage} alt={r.reward_name} className="w-12 h-12 rounded-[10px] object-cover border border-[var(--md-outline-variant)]" />
                          ) : (
                            <div className="w-12 h-12 rounded-[10px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container)] flex items-center justify-center text-[18px]">
                              🎁
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[13px] font-medium">{r.reward_name}</td>
                        <td className="px-5 py-3 text-right text-[var(--md-primary)]">{r.point_cost}</td>
                        <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-5 py-3 text-[12px] text-[var(--md-on-surface-variant)]">
                          {new Date(r.created_at).toLocaleString("th-TH")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Addresses */}
      <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] p-6">
        <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4">Addresses</h2>
        {addresses.length === 0 ? (
          <p className="text-[var(--md-on-surface-variant)]">No addresses</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((a) => (
              <div
                key={a.id}
                className={`p-4 rounded-[var(--md-radius-md)] border ${
                  a.is_default
                    ? "border-[var(--md-primary)] bg-[var(--md-primary-light)]/20"
                    : "border-[var(--md-outline-variant)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium">{a.label}</span>
                  {a.is_default && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--md-primary)] text-white">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[var(--md-on-surface)] mt-1">{a.recipient_name}</p>
                <p className="text-[13px] text-[var(--md-on-surface-variant)]">{a.phone}</p>
                <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-1">{a.address_line1}</p>
                {(a.province || a.postal_code) && (
                  <p className="text-[12px] text-[var(--md-on-surface-variant)]">
                    {[a.province, a.postal_code].filter(Boolean).join(" ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Management */}
      <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] border border-gray-200 dark:border-[var(--md-outline-variant)] p-6">
        <h2 className="text-[16px] font-medium text-[var(--md-on-surface)] mb-4">Account Management</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setTransferModal(true); setSelectedUser(null); setSearchQuery(""); setSearchResults([]); }}
            className="h-[40px] px-5 bg-blue-600 text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-blue-700 transition-all"
          >
            ย้าย LINE ID จาก account อื่น
          </button>
          <button
            onClick={() => { setMergeModal(true); setSelectedUser(null); setSearchQuery(""); setSearchResults([]); }}
            className="h-[40px] px-5 bg-orange-600 text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-orange-700 transition-all"
          >
            Merge Account
          </button>
        </div>
      </div>

      {/* Transfer LINE Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">ย้าย LINE ID จาก Account อื่น</h3>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-4">
              ค้นหา account ที่จะเอา LINE มา (ด้วยเบอร์, ชื่อ, email, หรือ ID)
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchUsers()}
                placeholder="ค้นหาด้วยเบอร์, ชื่อ, email..."
                className="flex-1 h-[44px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)]"
              />
              <button
                onClick={handleSearchUsers}
                disabled={searching}
                className="h-[44px] px-4 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-sm)] text-[14px] font-medium disabled:opacity-50"
              >
                {searching ? "..." : "ค้นหา"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-[250px] overflow-y-auto border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] mb-4">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors ${
                      selectedUser?.id === u.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <div className="text-[14px] font-medium text-[var(--md-on-surface)]">
                      {u.display_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div className="text-[12px] text-[var(--md-on-surface-variant)]">
                      {[u.phone, u.email, u.line_display_name ? `LINE: ${u.line_display_name}` : ""].filter(Boolean).join(" | ")}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-[var(--md-radius-sm)] mb-4 text-[13px]">
                <p className="font-medium">เลือก: {selectedUser.display_name || selectedUser.phone}</p>
                {selectedUser.line_display_name && <p>LINE: {selectedUser.line_display_name}</p>}
                {!selectedUser.line_user_id && <p className="text-red-600">⚠ account นี้ไม่มี LINE ผูกอยู่</p>}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setTransferModal(false)}
                className="h-[40px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-xl)] text-[14px] font-medium text-[var(--md-on-surface)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleTransferLINE}
                disabled={!selectedUser || !selectedUser.line_user_id || actionSubmitting}
                className="h-[40px] px-5 bg-blue-600 text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium disabled:opacity-50"
              >
                {actionSubmitting ? "กำลังย้าย..." : "ย้าย LINE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">Merge Account</h3>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mb-4">
              ค้นหา account ที่จะรวมเข้ามา (แต้ม, ประวัติสแกน, การแลกแต้ม จะถูกย้ายมารวมที่ account นี้)
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchUsers()}
                placeholder="ค้นหาด้วยเบอร์, ชื่อ, email..."
                className="flex-1 h-[44px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)]"
              />
              <button
                onClick={handleSearchUsers}
                disabled={searching}
                className="h-[44px] px-4 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-sm)] text-[14px] font-medium disabled:opacity-50"
              >
                {searching ? "..." : "ค้นหา"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-[250px] overflow-y-auto border border-[var(--md-outline-variant)] rounded-[var(--md-radius-sm)] mb-4">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--md-outline-variant)] last:border-b-0 hover:bg-[var(--md-surface-dim)] transition-colors ${
                      selectedUser?.id === u.id ? "bg-orange-50 dark:bg-orange-900/20" : ""
                    }`}
                  >
                    <div className="text-[14px] font-medium text-[var(--md-on-surface)]">
                      {u.display_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div className="text-[12px] text-[var(--md-on-surface-variant)]">
                      {[u.phone, u.email, u.line_display_name ? `LINE: ${u.line_display_name}` : ""].filter(Boolean).join(" | ")}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-[var(--md-radius-sm)] mb-4 text-[13px]">
                <p className="font-medium">เลือก: {selectedUser.display_name || selectedUser.phone}</p>
                <p className="text-orange-700 mt-1">⚠ Account ที่เลือกจะถูก merge เข้ามาและปิดการใช้งาน</p>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setMergeModal(false)}
                className="h-[40px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-xl)] text-[14px] font-medium text-[var(--md-on-surface)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleMerge}
                disabled={!selectedUser || actionSubmitting}
                className="h-[40px] px-5 bg-orange-600 text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium disabled:opacity-50"
              >
                {actionSubmitting ? "กำลัง merge..." : "Merge Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[var(--md-surface)] rounded-[var(--md-radius-lg)] p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-[18px] font-medium text-[var(--md-on-surface)] mb-4">Refund Points</h3>
            <form onSubmit={handleRefund} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--md-on-surface-variant)] mb-1.5">
                  Amount
                </label>
                <input
                  type="number"
                  min={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="จำนวน points"
                  className="w-full h-[48px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)]"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[var(--md-on-surface-variant)] mb-1.5">
                  Reason
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="เหตุผล (optional)"
                  rows={3}
                  className="w-full px-4 py-3 border border-[var(--md-outline)] rounded-[var(--md-radius-sm)] text-[14px] text-[var(--md-on-surface)] bg-transparent outline-none focus:border-[var(--md-primary)] resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRefundModal(false);
                    setRefundAmount("");
                    setRefundReason("");
                  }}
                  className="h-[40px] px-4 border border-[var(--md-outline)] rounded-[var(--md-radius-xl)] text-[14px] font-medium text-[var(--md-on-surface)] hover:bg-[var(--md-surface-dim)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundSubmitting}
                  className="h-[40px] px-5 bg-[var(--md-primary)] text-white rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-50"
                >
                  {refundSubmitting ? "Processing..." : "Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
