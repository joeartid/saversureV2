"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import StatusBadge from "./StatusBadge";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  { ssr: false }
);

export interface RedeemEntry {
  id: string;
  reward_name: string | null;
  reward_image_url?: string | null;
  status: string;
  tracking: string | null;
  delivery_type: string | null;
  coupon_code: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  district: string | null;
  sub_district: string | null;
  province: string | null;
  postal_code: string | null;
  confirmed_at: string | null;
  created_at: string;
  fulfillment_status?: string;
  tracking_number?: string | null;
}

const mediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

const deliveryLabels: Record<string, string> = {
  shipping: "จัดส่งถึงบ้าน",
  coupon: "คูปอง",
  digital: "ดิจิทัล",
  ticket: "ตั๋ว",
  pickup: "รับหน้าร้าน",
};

interface RedeemCardProps {
  entry: RedeemEntry;
  compact?: boolean;
  expanded?: boolean;
  onToggleDetail?: (id: string) => void;
}

export default function RedeemCard({
  entry: e,
  compact = false,
  expanded = false,
  onToggleDetail,
}: RedeemCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showTrackingPopup, setShowTrackingPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const imgSrc = mediaUrl(e.reward_image_url);
  const deliveryLabel = deliveryLabels[e.delivery_type || ""] || "ทั่วไป";

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addressText = [e.address_line1, e.address_line2, e.sub_district, e.district, e.province, e.postal_code]
    .filter(Boolean)
    .join(" ");

  const actionLabel = e.coupon_code ? "ดูโค้ด" : "ดูรายละเอียด";

  const getFulfillmentStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "รับเรื่องแล้ว";
      case "preparing":
        return "กำลังเตรียมจัดส่ง";
      case "shipped":
        return "กำลังจัดส่ง";
      case "delivered":
        return "จัดส่งสำเร็จ";
      default:
        return status;
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case "pending":
        return "เราได้รับคำสั่งซื้อของคุณแล้ว";
      case "preparing":
        return "กำลังเตรียมสินค้าของคุณ";
      case "shipped":
        return "สินค้าอยู่ระหว่างการจัดส่ง";
      case "delivered":
        return "สินค้าถูกจัดส่งถึงปลายทางแล้ว";
      default:
        return "กำลังดำเนินการ";
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden card-green-border">
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        {/* Product thumbnail */}
        <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-gray-50 ring-1 ring-gray-100">
          {imgSrc ? (
            <Image src={imgSrc} alt={e.reward_name || "Reward"} fill className="object-cover" sizes="48px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--jh-green)" strokeWidth="1.5" className="w-6 h-6 opacity-50">
                <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold truncate">{e.reward_name || "Reward"}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground">
              {new Date(e.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="text-[10px] text-muted-foreground bg-gray-100 rounded px-1.5 py-0.5">{deliveryLabel}</span>
          </div>
        </div>

        {/* Status + Action */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Show fulfillment status if available, otherwise show regular status */}
          <StatusBadge status={e.fulfillment_status || e.status} />
          
          {/* Single button for shipping items */}
          {e.delivery_type === "shipping" && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline bg-blue-50 px-3 py-1 rounded-full"
            >
              ติดตามสถานะ
            </button>
          )}
          
          {/* Regular detail button for non-shipping items */}
          {!compact && onToggleDetail && e.delivery_type !== "shipping" && (
            <button
              onClick={() => onToggleDetail(e.id)}
              className="text-[11px] font-semibold text-[var(--jh-green)] hover:underline"
            >
              {expanded ? "ซ่อน" : actionLabel}
            </button>
          )}
        </div>
      </div>

      
      {/* Expandable Detail Section */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/20">
          <div className="px-3 py-2 space-y-1.5 text-xs">
            {/* Address */}
            {addressText && (
              <div className="flex items-start gap-1">
                <span className="text-gray-500 shrink-0">ที่อยู่:</span>
                <span className="text-gray-800 leading-tight">{addressText}</span>
              </div>
            )}
            
            {/* Status */}
            <div className="flex items-center gap-1">
              <span className="text-gray-500 shrink-0">สถานะ:</span>
              <span className="text-gray-800 font-medium">
                {getFulfillmentStatusText(e.fulfillment_status || e.status)}
              </span>
            </div>
            
            {/* Tracking */}
            {(e.tracking_number || e.tracking) && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500 shrink-0">Tracking:</span>
                <span className="font-mono text-blue-600 font-medium">
                  {e.tracking_number || e.tracking}
                </span>
                <button
                  onClick={() => {
                    const trackingNum = e.tracking_number || e.tracking;
                    if (trackingNum) {
                      navigator.clipboard.writeText(trackingNum);
                      alert('คัดลอกเลขพัสดุแล้ว!');
                    }
                  }}
                  className="bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 text-[10px] ml-auto"
                >
                  คัดลอก
                </button>
                <button
                  onClick={() => window.open(`/tracking/${e.id}`, '_blank')}
                  className="bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 text-[10px]"
                >
                  เปิด
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Popup */}
      {showDetailPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">รายละเอียดคำสั่ง</h3>
              <button
                onClick={() => setShowDetailPopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Product Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">{e.reward_name || "ของรางวัล"}</h4>
                <p className="text-sm text-gray-600">ID: {e.id}</p>
                <p className="text-sm text-gray-600">แลกเมื่อ: {new Date(e.created_at).toLocaleString("th-TH")}</p>
                {e.confirmed_at && (
                  <p className="text-sm text-gray-600">ยืนยันเมื่อ: {new Date(e.confirmed_at).toLocaleString("th-TH")}</p>
                )}
              </div>
              
              {/* Delivery Info */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ข้อมูลการจัดส่ง
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">ประเภทจัดส่ง:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {deliveryLabels[e.delivery_type || ""] || "ทั่วไป"}
                    </span>
                  </div>
                  {e.recipient_name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ชื่อผู้รับ:</span>
                      <span className="text-sm font-medium text-gray-900">{e.recipient_name}</span>
                    </div>
                  )}
                  {e.recipient_phone && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">เบอร์ผู้รับ:</span>
                      <span className="text-sm font-medium text-gray-900">{e.recipient_phone}</span>
                    </div>
                  )}
                  {addressText && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">ที่อยู่จัดส่ง:</span>
                      <p className="text-gray-900 mt-1">{addressText}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status Timeline */}
              <div className="bg-yellow-50 rounded-xl p-4">
                <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21l6-6m-6 6l6-6" />
                  </svg>
                  สถานะการจัดส่ง
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getFulfillmentStatusText(e.fulfillment_status || e.status)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getStatusDescription(e.fulfillment_status || e.status)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetailPopup(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Popup */}
      {showTrackingPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">ติดตามพัสดุ</h3>
              <button
                onClick={() => setShowTrackingPopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-2">เลขพัสดุ:</p>
                <p className="font-mono text-lg font-bold text-blue-600">
                  {e.tracking_number || e.tracking || "ไม่มีเลขพัสดุ"}
                </p>
                <button
                  onClick={() => {
                    const trackingNum = e.tracking_number || e.tracking;
                    if (trackingNum) {
                      navigator.clipboard.writeText(trackingNum);
                      alert('คัดลอกเลขพัสดุแล้ว!');
                    }
                  }}
                  className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
                >
                  คัดลอก
                </button>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    window.open(`/tracking/${e.id}`, '_blank');
                    setShowTrackingPopup(false);
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"
                >
                  เปิดหน้า Tracking
                </button>
                <button
                  onClick={() => setShowTrackingPopup(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {!compact && expanded && (
        <div className="border-t border-gray-100 mx-4 pt-3 pb-4 space-y-3">
          {/* Status detail */}
          <div className="rounded-xl bg-secondary p-3 text-[13px] space-y-1.5">
            {e.confirmed_at && (
              <p><span className="text-muted-foreground">ยืนยันเมื่อ:</span> {new Date(e.confirmed_at).toLocaleString("th-TH")}</p>
            )}
            {e.recipient_name && (
              <p><span className="text-muted-foreground">ชื่อผู้รับ:</span> {e.recipient_name}</p>
            )}
            {e.recipient_phone && (
              <p><span className="text-muted-foreground">เบอร์ผู้รับ:</span> {e.recipient_phone}</p>
            )}
            {addressText && (
              <p><span className="text-muted-foreground">ที่อยู่จัดส่ง:</span> {addressText}</p>
            )}
          </div>

          {/* Coupon code */}
          {e.coupon_code && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
              <button onClick={() => setShowQR(!showQR)} className="w-full p-3 flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700">Coupon Code</span>
                <span className="text-[11px] text-blue-500">{showQR ? "ซ่อน QR" : "แสดง QR"}</span>
              </button>
              {showQR && (
                <div className="flex justify-center pb-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <QRCodeSVG
                      value={e.coupon_code}
                      size={120}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>
              )}
              <div className="px-3 pb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold font-mono text-blue-700 break-all">{e.coupon_code}</p>
                <button
                  onClick={() => handleCopy(e.coupon_code!)}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white"
                >
                  {copied ? "✓ คัดลอก" : "คัดลอก"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
