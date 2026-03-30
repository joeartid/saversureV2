"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { api, ApiError } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RewardDetail {
  id: string;
  name: string;
  description: string;
  point_cost: number;
  normal_point_cost: number;
  price: number;
  cost_currency: string;
  image_url?: string;
  delivery_type: string;
  type: string;
  total_qty: number;
  reserved_qty: number;
  sold_qty: number;
  available_qty: number;
  is_flash: boolean;
  flash_start?: string;
  flash_end?: string;
  tier_id?: string;
  tier_name?: string;
  coupon_available_count: number;
}

interface RedeemResult {
  reservation_id: string;
  reward_id: string;
  status: string;
  coupon_code?: string;
  delivery_type?: string;
}

interface CurrencyMaster {
  code: string;
  name: string;
  icon: string;
  active: boolean;
}

interface AddressEntry {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  district?: string | null;
  sub_district?: string | null;
  province?: string | null;
  postal_code?: string | null;
  is_default: boolean;
}

interface AddressFormState {
  label: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  district: string;
  sub_district: string;
  province: string;
  postal_code: string;
}

const currencyFallback: Record<string, string> = {
  point: "🪙",
  diamond: "💎",
};

const deliveryLabel: Record<string, { label: string; icon: string; desc: string }> = {
  shipping: { label: "จัดส่งถึงบ้าน", icon: "📦", desc: "สินค้าจะจัดส่งไปยังที่อยู่ที่ลงทะเบียนไว้" },
  coupon: { label: "คูปองออนไลน์", icon: "🎫", desc: "รับรหัสคูปองทันทีหลังแลก" },
  pickup: { label: "รับหน้าร้าน", icon: "📍", desc: "แสดง QR Code ที่ร้านเพื่อรับสินค้า" },
  digital: { label: "ดิจิทัล", icon: "📱", desc: "รับทางดิจิทัลทันที" },
  ticket: { label: "ตั๋ว/บัตรเข้างาน", icon: "🎟️", desc: "รับ QR Code เป็นตั๋วเข้าร่วมงาน" },
  none: { label: "ติดต่อรับสินค้า", icon: "📋", desc: "ทีมงานจะติดต่อกลับเพื่อนัดรับสินค้า" },
};

const mediaUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
};

const emptyAddressForm: AddressFormState = {
  label: "home",
  recipient_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  district: "",
  sub_district: "",
  province: "",
  postal_code: "",
};

export default function RewardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [reward, setReward] = useState<RewardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userBalance, setUserBalance] = useState<Record<string, number>>({});
  const [currencyMap, setCurrencyMap] = useState<Record<string, CurrencyMaster>>({});
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AddressEntry[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm);

  const getIcon = (code: string) => {
    const c = currencyMap[code.toLowerCase()];
    return c?.icon || currencyFallback[code.toLowerCase()] || "⭐";
  };

  const getCurrName = (code: string) => {
    const c = currencyMap[code.toLowerCase()];
    return c?.name || code;
  };

  const formatAddress = (address?: Partial<AddressEntry> | null) =>
    [address?.address_line1, address?.address_line2, address?.sub_district, address?.district, address?.province, address?.postal_code]
      .filter(Boolean)
      .join(" ");

  useEffect(() => {
    api
      .get<RewardDetail>(`/api/v1/public/rewards/${id}`)
      .then(setReward)
      .catch(() => setReward(null))
      .finally(() => setLoading(false));

    api
      .get<{ data: CurrencyMaster[] }>("/api/v1/public/currencies")
      .then((d) => {
        const map: Record<string, CurrencyMaster> = {};
        (d.data || []).forEach((c) => (map[c.code.toLowerCase()] = c));
        setCurrencyMap(map);
      })
      .catch(() => {});

    if (isLoggedIn()) {
      api
        .get<{ data: { currency: string; balance: number }[] }>("/api/v1/my/balances")
        .then((d) => {
          const map: Record<string, number> = {};
          (d.data || []).forEach((b) => (map[b.currency.toLowerCase()] = b.balance));
          setUserBalance(map);
        })
        .catch(() => {});

      api
        .get<{ data: AddressEntry[] }>("/api/v1/profile/addresses")
        .then((d) => {
          const items = d.data || [];
          setSavedAddresses(items);
          const defaultAddress = items.find((item) => item.is_default) || items[0];
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
          } else {
            setUseNewAddress(true);
          }
        })
        .catch(() => {});
    }
  }, [id]);

  const handleRedeem = async () => {
    if (!reward) return;
    setRedeeming(true);
    setError(null);

    try {
      let addressId: string | undefined;
      if (reward.delivery_type === "shipping") {
        if (useNewAddress || !selectedAddressId) {
          if (!addressForm.recipient_name.trim() || !addressForm.phone.trim() || !addressForm.address_line1.trim()) {
            setError("กรุณากรอกชื่อผู้รับ เบอร์โทร และที่อยู่จัดส่งให้ครบ");
            setRedeeming(false);
            return;
          }

          const createdAddress = await api.post<AddressEntry>("/api/v1/profile/addresses", {
            label: addressForm.label || "home",
            recipient_name: addressForm.recipient_name.trim(),
            phone: addressForm.phone.trim(),
            address_line1: addressForm.address_line1.trim(),
            address_line2: addressForm.address_line2.trim() || undefined,
            district: addressForm.district.trim() || undefined,
            sub_district: addressForm.sub_district.trim() || undefined,
            province: addressForm.province.trim() || undefined,
            postal_code: addressForm.postal_code.trim() || undefined,
            is_default: savedAddresses.length === 0,
          });
          addressId = createdAddress.id;
          setSavedAddresses((prev) => [createdAddress, ...prev]);
          setSelectedAddressId(createdAddress.id);
        } else {
          addressId = selectedAddressId;
        }
      }

      const idempotencyKey = `redeem-${reward.id}-${Date.now()}`;
      const result = await api.post<RedeemResult>(
        "/api/v1/redeem",
        { reward_id: reward.id, address_id: addressId },
        idempotencyKey
      );
      setRedeemResult(result);
      setShowConfirm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const errMsg: Record<string, string> = {
          out_of_stock: "ของรางวัลนี้หมดแล้ว",
          no_coupon_available: "ไม่มีรหัสคูปองเหลือแล้ว",
          default_address_required: "กรุณาตั้งค่าที่อยู่จัดส่งก่อน",
          address_not_found: "ไม่พบที่อยู่จัดส่งที่เลือก",
          insufficient_balance: "แต้มของคุณไม่เพียงพอ",
        };
        setError(errMsg[err.data.error as string] || (err.data.message as string) || "ไม่สามารถแลกรางวัลได้ กรุณาลองใหม่");
      } else {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="pb-36 min-h-screen bg-background">
        <Navbar />
        <div className="pt-24">
          <div className="aspect-square bg-muted animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            <div className="h-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!reward) {
    return (
      <div className="pb-36 min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 flex flex-col items-center justify-center px-6" style={{ minHeight: "60vh" }}>
          <p className="text-lg font-bold mb-2">ไม่พบรางวัล</p>
          <p className="text-sm text-muted-foreground mb-6">รางวัลนี้อาจถูกลบหรือไม่มีอยู่แล้ว</p>
          <Link href="/rewards" className="rounded-full bg-[var(--jh-green)] px-8 py-2.5 text-sm font-bold text-white">
            กลับหน้ารางวัล
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const imgSrc = mediaUrl(reward.image_url);
  const emoji = getIcon(reward.cost_currency);
  const currName = getCurrName(reward.cost_currency);
  const balance = userBalance[reward.cost_currency.toLowerCase()] ?? 0;
  const canAfford = balance >= reward.point_cost;
  const outOfStock = reward.available_qty <= 0;
  const delivery = deliveryLabel[reward.delivery_type] || deliveryLabel.none;
  const stockPct = reward.total_qty > 0 ? Math.round(((reward.total_qty - reward.available_qty) / reward.total_qty) * 100) : 0;
  const selectedAddress = savedAddresses.find((item) => item.id === selectedAddressId);

  return (
    <div className="pb-36 min-h-screen bg-background">
      <Navbar />

      <div className="pt-24">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-[72px] left-4 z-20 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Image */}
        <div className="aspect-square bg-secondary relative overflow-hidden">
          {imgSrc ? (
            <Image src={imgSrc} alt={reward.name} fill className="object-cover" sizes="100vw" priority />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="w-24 h-24 text-muted-foreground/20">
                <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21" />
              </svg>
            </div>
          )}

          {reward.is_flash && (
            <Badge className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 text-xs font-bold animate-pulse">
              ⚡ FLASH DEAL
            </Badge>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">หมดแล้ว</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4">
          {/* Name & Price */}
          <div>
            <h1 className="text-xl font-bold leading-tight">{reward.name}</h1>
            {reward.price > 0 && (
              <p className="text-sm text-muted-foreground mt-1">ราคาปกติ {reward.price.toLocaleString()} บาท</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-bold text-[var(--jh-green)] relative group cursor-default">
                <span>{emoji}</span> {reward.point_cost.toLocaleString()}
                <span className="absolute -top-7 left-0 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  {currName}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">
                {currName}
              </span>
              {reward.normal_point_cost > reward.point_cost && (
                <span className="text-sm text-muted-foreground line-through ml-2">
                  ปกติ {reward.normal_point_cost.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Balance check */}
          {isLoggedIn() && (
            <Card className={`border-0 shadow-sm ${canAfford ? "bg-green-50" : "bg-amber-50"}`}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">คงเหลือของคุณ ({currName})</p>
                  <p className={`text-lg font-bold ${canAfford ? "text-[var(--jh-green)]" : "text-amber-600"}`}>
                    {emoji} {balance.toLocaleString()}
                  </p>
                </div>
                {canAfford ? (
                  <Badge className="bg-green-100 text-green-700 text-xs">แลกได้</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">
                    ขาดอีก {(reward.point_cost - balance).toLocaleString()}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}

          {/* Delivery type */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-2xl">{delivery.icon}</span>
              <div>
                <p className="text-sm font-semibold">{delivery.label}</p>
                <p className="text-xs text-muted-foreground">{delivery.desc}</p>
              </div>
            </CardContent>
          </Card>

          {/* Stock */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">คงเหลือ</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${stockPct > 80 ? "bg-red-400" : stockPct > 50 ? "bg-amber-400" : "bg-[var(--jh-green)]"}`}
                  style={{ width: `${stockPct}%` }}
                />
              </div>
              <span className={`font-bold ${reward.available_qty <= 10 ? "text-red-500" : ""}`}>
                {reward.available_qty.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Description */}
          {reward.description && (
            <div>
              <h3 className="text-sm font-semibold mb-2">รายละเอียด</h3>
              <div 
                className="text-sm text-muted-foreground leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-bold [&_a]:text-[var(--jh-green)] [&_a]:underline break-words"
                dangerouslySetInnerHTML={{ __html: reward.description }}
              />
            </div>
          )}

          {/* Tier requirement */}
          {reward.tier_name && (
            <Card className="border-0 shadow-sm bg-amber-50">
              <CardContent className="p-3 flex items-center gap-2">
                <span className="text-lg">👑</span>
                <p className="text-sm">
                  สำหรับสมาชิกระดับ <span className="font-bold text-amber-700">{reward.tier_name}</span> ขึ้นไป
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Redeem Success Modal */}
      {redeemResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="border-0 shadow-xl w-full max-w-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-[var(--jh-green)] px-6 pt-8 pb-6 text-center text-white">
                <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">แลกรางวัลสำเร็จ!</h2>
                <p className="text-sm text-white/80 mt-1">{reward.name}</p>
              </div>

              <div className="p-6 space-y-4">
                {redeemResult.coupon_code && (
                  <div className="rounded-xl border-2 border-dashed border-[var(--jh-green)] p-4 text-center bg-green-50">
                    <p className="text-xs text-muted-foreground mb-1">รหัสคูปอง</p>
                    <p className="text-2xl font-bold font-mono text-[var(--jh-green)] tracking-wider">
                      {redeemResult.coupon_code}
                    </p>
                  </div>
                )}

                {redeemResult.delivery_type === "shipping" && (
                  <p className="text-sm text-center text-muted-foreground">
                    📦 สินค้าจะจัดส่งไปยังที่อยู่ของคุณ กรุณารอ 5-7 วันทำการ
                  </p>
                )}

                {redeemResult.delivery_type === "ticket" && (
                  <p className="text-sm text-center text-muted-foreground">
                    🎟️ ตั๋วของคุณถูกบันทึกแล้ว ดูรายละเอียดได้ในประวัติการแลกแต้ม
                  </p>
                )}

                {redeemResult.delivery_type === "digital" && (
                  <p className="text-sm text-center text-muted-foreground">
                    📱 ของรางวัลดิจิทัลพร้อมใช้งาน ดูรายละเอียดในประวัติ
                  </p>
                )}

                <div className="flex gap-2">
                  <Link
                    href="/history/redeems"
                    className="flex-1 rounded-full border-2 border-[var(--jh-green)] py-2.5 text-center text-sm font-bold text-[var(--jh-green)]"
                  >
                    ดูประวัติ
                  </Link>
                  <Link
                    href="/rewards"
                    className="flex-1 rounded-full bg-[var(--jh-green)] py-2.5 text-center text-sm font-bold text-white"
                  >
                    กลับหน้ารางวัล
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="border-0 shadow-xl w-full max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-secondary flex items-center justify-center mb-3">
                  <span className="text-3xl">{emoji}</span>
                </div>
                <h3 className="text-lg font-bold">ยืนยันการแลกรางวัล</h3>
                <p className="text-sm text-muted-foreground mt-1">{reward.name}</p>
              </div>

              <div className="rounded-xl bg-secondary p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ใช้ {currName}</span>
                  <span className="font-bold text-red-500">{emoji} - {reward.point_cost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">คงเหลือหลังแลก</span>
                  <span className="font-bold text-[var(--jh-green)]">
                    {emoji} {(balance - reward.point_cost).toLocaleString()}
                  </span>
                </div>
              </div>

              {reward.delivery_type === "shipping" && (
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">ข้อมูลจัดส่ง</p>
                    {savedAddresses.length > 0 && (
                      <button
                        onClick={() => setUseNewAddress((prev) => !prev)}
                        type="button"
                        className="text-[11px] font-semibold text-[var(--jh-green)]"
                      >
                        {useNewAddress ? "เลือกจากที่อยู่เดิม" : "กรอกที่อยู่ใหม่"}
                      </button>
                    )}
                  </div>

                  {!useNewAddress && selectedAddress && (
                    <div className="space-y-2">
                      <select
                        value={selectedAddressId}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                      >
                        {savedAddresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.recipient_name} ({address.phone}){address.is_default ? " [หลัก]" : ""}
                          </option>
                        ))}
                      </select>
                      <div className="rounded-xl bg-secondary p-3 text-[13px] text-muted-foreground">
                        <p className="font-medium text-foreground">{selectedAddress.recipient_name}</p>
                        <p>{selectedAddress.phone}</p>
                        <p className="mt-1">{formatAddress(selectedAddress)}</p>
                      </div>
                    </div>
                  )}

                  {(useNewAddress || !selectedAddress) && (
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        value={addressForm.recipient_name}
                        onChange={(e) => setAddressForm((prev) => ({ ...prev, recipient_name: e.target.value }))}
                        placeholder="ชื่อผู้รับ *"
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                      />
                      <input
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="เบอร์โทร *"
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                      />
                      <input
                        value={addressForm.address_line1}
                        onChange={(e) => setAddressForm((prev) => ({ ...prev, address_line1: e.target.value }))}
                        placeholder="บ้านเลขที่ / ถนน / หมู่บ้าน *"
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                      />
                      <input
                        value={addressForm.address_line2}
                        onChange={(e) => setAddressForm((prev) => ({ ...prev, address_line2: e.target.value }))}
                        placeholder="อาคาร / ชั้น / ห้อง (ถ้ามี)"
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={addressForm.sub_district}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, sub_district: e.target.value }))}
                          placeholder="แขวง/ตำบล"
                          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                        />
                        <input
                          value={addressForm.district}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, district: e.target.value }))}
                          placeholder="เขต/อำเภอ"
                          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={addressForm.province}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, province: e.target.value }))}
                          placeholder="จังหวัด"
                          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                        />
                        <input
                          value={addressForm.postal_code}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                          placeholder="รหัสไปรษณีย์"
                          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-center">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowConfirm(false); setError(null); }}
                  className="flex-1 rounded-full border-2 border-border py-3 text-sm font-bold text-muted-foreground"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleRedeem}
                  disabled={redeeming}
                  className="flex-1 rounded-full bg-[var(--jh-green)] py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98] transition"
                >
                  {redeeming ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      กำลังดำเนินการ...
                    </span>
                  ) : (
                    "ยืนยันแลกรางวัล"
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fixed bottom CTA */}
      {!redeemResult && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-white/95 backdrop-blur-md p-4 app-fixed-bar">
          <div className="max-w-lg mx-auto">
            {!isLoggedIn() ? (
              <Link
                href="/"
                className="block w-full rounded-full bg-[var(--jh-green)] py-3.5 text-center text-[15px] font-bold text-white"
              >
                เข้าสู่ระบบเพื่อแลกรางวัล
              </Link>
            ) : outOfStock ? (
              <button disabled className="w-full rounded-full bg-muted py-3.5 text-[15px] font-bold text-muted-foreground cursor-not-allowed">
                สินค้าหมด
              </button>
            ) : !canAfford ? (
              <button disabled className="w-full rounded-full bg-muted py-3.5 text-[15px] font-bold text-muted-foreground cursor-not-allowed">
                {currName}ไม่เพียงพอ (ขาดอีก {(reward.point_cost - balance).toLocaleString()})
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full rounded-full bg-[var(--jh-green)] py-3.5 text-[15px] font-bold text-white active:scale-[0.98] transition shadow-lg shadow-[var(--jh-green)]/30"
              >
                แลกรางวัล {emoji} {reward.point_cost.toLocaleString()} {currName}
              </button>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
