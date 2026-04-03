"use client";

const statusMap: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: "รออนุมัติ", bg: "bg-amber-50", text: "text-amber-700" },
  CONFIRMED: { label: "อนุมัติแล้ว", bg: "bg-blue-50", text: "text-blue-700" },
  SHIPPING: { label: "กำลังจัดส่ง", bg: "bg-orange-50", text: "text-orange-700" },
  SHIPPED: { label: "จัดส่งแล้ว", bg: "bg-green-50", text: "text-green-700" },
  COMPLETED: { label: "สำเร็จแล้ว", bg: "bg-green-50", text: "text-[var(--jh-green)]" },
  EXPIRED: { label: "หมดอายุ", bg: "bg-gray-100", text: "text-gray-500" },
  CANCELLED: { label: "ยกเลิก", bg: "bg-red-50", text: "text-red-600" },
  // Fulfillment statuses
  preparing: { label: "กำลังเตรียมจัดส่ง", bg: "bg-purple-50", text: "text-purple-700" },
  shipped: { label: "กำลังจัดส่ง", bg: "bg-blue-50", text: "text-blue-700" },
  delivered: { label: "จัดส่งสำเร็จ", bg: "bg-green-50", text: "text-green-700" },
  // Mission statuses
  completed: { label: "สำเร็จแล้ว", bg: "bg-green-50", text: "text-[var(--jh-green)]" },
  in_progress: { label: "กำลังดำเนินการ", bg: "bg-blue-50", text: "text-blue-700" },
  not_started: { label: "ยังไม่เริ่ม", bg: "bg-gray-100", text: "text-gray-500" },
  // Lucky draw
  won: { label: "ชนะ!", bg: "bg-green-50", text: "text-[var(--jh-green)]" },
  lost: { label: "ไม่ได้รับรางวัล", bg: "bg-gray-100", text: "text-gray-500" },
  pending_draw: { label: "รอจับรางวัล", bg: "bg-amber-50", text: "text-amber-700" },
};

const fallback = { label: "—", bg: "bg-gray-100", text: "text-gray-500" };

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  customLabel?: string;
}

export default function StatusBadge({ status, size = "sm", customLabel }: StatusBadgeProps) {
  const s = statusMap[status] || fallback;
  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${s.bg} ${s.text} ${sizeClass}`}>
      {customLabel || s.label}
    </span>
  );
}

export { statusMap };
