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
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [profilePrefill, setProfilePrefill] = useState<{name: string, phone: string} | null>(null);

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
    if (id === "mock-0-point-test") {
      setReward({
        id: "mock-0-point-test",
        name: "[TEST] ไอเทมเทสระบบ 0 แต้ม ฟรี!",
        description: "<h2 style='font-size:18px;font-weight:bold;margin-bottom:8px'>โหมดทดสอบพิเศษ 🎁</h2><p>สินค้านี้ถูก 'เสก' ขึ้นมาเฉพาะในฝั่งเว็บเพื่อให้คุณกดเทส Flow ของขวัญฟรี (0 แต้ม) ได้เลย <b>โดยไม่ลง Database</b> เพื่อรักษากฎ Read-only ของฐานข้อมูลเอาไว้ครับ!</p>",
        point_cost: 0,
        normal_point_cost: 499,
        price: 999,
        cost_currency: "point",
        image_url: "",
        delivery_type: "shipping",
        type: "product",
        total_qty: 1000,
        reserved_qty: 0,
        sold_qty: 1,
        available_qty: 999,
        is_flash: true,
        tier_name: "Member",
        coupon_available_count: 999
      });
      setLoading(false);
    } else {
      api
        .get<RewardDetail>(`/api/v1/public/rewards/${id}`)
        .then(setReward)
        .catch(() => setReward(null))
        .finally(() => setLoading(false));
    }

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
          let items = d.data || [];
          setSavedAddresses(items);
          const defaultAddress = items.find((item) => item.is_default) || items[0];
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
          }
        })
        .catch(() => {});

      api.get<any>("/api/v1/profile")
        .then(prof => {
          if (prof) {
            setProfilePrefill({
              name: [prof.first_name, prof.last_name].filter(Boolean).join(" "),
              phone: prof.phone || ""
            });
          }
        }).catch(() => {});
    }
  }, [id]);

  const handleRedeem = async () => {
    if (!reward) return;
    setRedeeming(true);
    setError(null);

    try {
      if (reward.id === "mock-0-point-test") {
        if (reward.delivery_type === "shipping" && !selectedAddressId) {
          setError("กรุณาเลือกที่อยู่จัดส่ง");
          setRedeeming(false);
          return;
        }

        setTimeout(() => {
          setRedeemResult({
            reservation_id: "res-test-mock-success",
            reward_id: reward.id,
            status: "success",
            coupon_code: undefined,
            delivery_type: "shipping"
          });
          setShowConfirm(false);
          setRedeeming(false);
        }, 1500);
        return;
      }

      let addressId: string | undefined;
      if (reward.delivery_type === "shipping") {
        // Validate that selectedAddressId actually exists in current fetched list
        // (protects against stale state / old mock IDs)
        const validAddress = savedAddresses.find(a => a.id === selectedAddressId)
          || savedAddresses.find(a => a.is_default)
          || savedAddresses[0];

        if (!validAddress) {
          setError("กรุณาเลือกที่อยู่จัดส่ง");
          setRedeeming(false);
          return;
        }
        // Auto-correct to the valid address
        setSelectedAddressId(validAddress.id);
        addressId = validAddress.id;
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

  const handleSaveNewAddress = async () => {
    if (!addressForm.recipient_name.trim() || !addressForm.phone.trim() || !addressForm.address_line1.trim()) {
      setError("กรุณากรอกชื่อผู้รับ เบอร์โทร และที่อยู่ให้ครบ");
      return;
    }
    try {
      const createdAddress = await api.post<AddressEntry>("/api/v1/profile/addresses", {
        label: "home",
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
      setSavedAddresses(prev => [createdAddress, ...prev]);
      setSelectedAddressId(createdAddress.id);
      setShowAddressForm(false);
      setShowAddressSelector(false); // Close selector too if it was open
      setError(null);
    } catch (err: any) {
      setError(err.message || "ไม่สามารถเพิ่มที่อยู่ได้ กรุณาลองใหม่");
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
          className="absolute top-[110px] left-4 z-20 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center"
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
              <span className="text-white text-base font-bold">หมดแล้ว</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4">
          {/* Name & Price */}
          <div>
            <h1 className="text-base font-extrabold leading-tight text-gray-900">{reward.name}</h1>
            {reward.price > 0 && (
              <p className="text-xs text-muted-foreground mt-1">ราคาปกติ {reward.price.toLocaleString()} บาท</p>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-lg font-bold text-[var(--jh-green)] relative group cursor-default flex items-center gap-1">
                <span className="text-xl">{emoji}</span> {reward.point_cost.toLocaleString()}
                <span className="absolute -top-7 left-0 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  {currName}
                </span>
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                {currName}
              </span>
              {reward.normal_point_cost > reward.point_cost && (
                <span className="text-xs text-muted-foreground line-through ml-2">
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
                  <p className="text-[11px] text-muted-foreground">คงเหลือของคุณ ({currName})</p>
                  <p className={`text-base font-bold flex items-center gap-1.5 mt-0.5 ${canAfford ? "text-[var(--jh-green)]" : "text-amber-600"}`}>
                    <span className="text-lg">{emoji}</span> {balance.toLocaleString()}
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
              <span className="text-xl leading-none">{delivery.icon}</span>
              <div>
                <p className="text-[13px] font-bold text-gray-800">{delivery.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{delivery.desc}</p>
              </div>
            </CardContent>
          </Card>

          {/* Stock */}
          <div className="flex items-center justify-between text-xs px-1">
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
            <div className="pt-2">
              <h3 className="text-[13px] font-bold mb-2 text-gray-900">รายละเอียด</h3>
              <div 
                className="text-xs text-muted-foreground leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-bold [&_a]:text-[var(--jh-green)] [&_a]:underline break-words"
                dangerouslySetInnerHTML={{ __html: reward.description }}
              />
            </div>
          )}

          {/* Tier requirement */}
          {reward.tier_name && (
            <Card className="border-0 shadow-sm bg-amber-50">
              <CardContent className="p-3 flex items-center gap-2">
                <span className="text-base">👑</span>
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
                <h2 className="text-lg font-bold">แลกรางวัลสำเร็จ!</h2>
                <p className="text-sm text-white/80 mt-1">{reward.name}</p>
              </div>

              <div className="p-6 space-y-4">
                {redeemResult.coupon_code && !["product", "premium"].includes(String(reward.type).toLowerCase()) && (
                  <div className="rounded-xl border-2 border-dashed border-[var(--jh-green)] p-4 text-center bg-green-50">
                    <p className="text-xs text-muted-foreground mb-1">รหัสคูปอง</p>
                    <p className="text-xl font-bold font-mono text-[var(--jh-green)] tracking-wider">
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
                    href="/"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="border-0 shadow-xl w-full max-w-sm rounded-[24px] overflow-hidden bg-white">
            <CardContent className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[15px] font-extrabold text-gray-900">ยืนยันการแลกรางวัล</h3>
                <button onClick={() => { setShowConfirm(false); setError(null); }} className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 flex gap-4 mb-5">
                <div className="w-[64px] h-[64px] bg-white rounded-xl border border-gray-200 overflow-hidden relative flex-shrink-0">
                  {imgSrc ? <Image src={imgSrc} fill className="object-cover" sizes="64px" alt="" /> : null}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="font-bold text-[14px] leading-tight text-gray-800 line-clamp-2">{reward.name}</p>
                  <p className="text-[11px] text-gray-500 mt-1 font-medium">ใช้แต้มแลกรับ</p>
                  <p className="font-extrabold text-[15px] text-[var(--jh-green)] -mt-0.5">
                    -{reward.point_cost.toLocaleString()} P
                  </p>
                </div>
              </div>

              {reward.delivery_type === "shipping" && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[14px] font-bold text-gray-800">จัดส่งไปที่</p>
                    <button
                      onClick={() => setShowAddressSelector(true)}
                      type="button"
                      className="text-[12px] font-bold bg-green-50 text-[var(--jh-green)] px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors"
                    >
                      {savedAddresses.length > 0 ? (selectedAddress ? "เปลี่ยนที่อยู่" : "เลือกที่อยู่") : "เพิ่มที่อยู่"}
                    </button>
                  </div>
                  
                  {selectedAddress ? (
                    <div className="rounded-2xl border border-[var(--jh-green)] p-3 relative bg-white overflow-hidden shadow-sm">
                      <div className="absolute top-0 bottom-0 left-0 w-[5px] bg-[var(--jh-green)]"></div>
                      <div className="pl-3">
                        <div className="flex items-center gap-2 mb-1.5">
                           <p className="font-bold text-[14px] text-gray-900">{selectedAddress.recipient_name}</p>
                           <span className="bg-gray-100 text-gray-500 text-[11px] px-2 py-0.5 rounded-md font-medium tracking-wide">
                             {selectedAddress.phone}
                           </span>
                        </div>
                        <p className="text-[12px] text-gray-500 leading-relaxed pr-2">{formatAddress(selectedAddress)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-300 p-4 bg-gray-50 text-center flex flex-col items-center justify-center min-h-[100px] cursor-pointer" onClick={() => {
                        setAddressForm({ ...emptyAddressForm, recipient_name: profilePrefill?.name || "", phone: profilePrefill?.phone || "" });
                        setShowAddressForm(true);
                      }}>
                      <span className="text-xl mb-1 text-gray-400">🏡</span>
                      <p className="text-[14px] font-bold text-[var(--jh-green)]">+ แตะเพื่อเพิ่มที่อยู่จัดส่ง</p>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-[20px] bg-gray-50/80 p-4 border border-gray-100 mb-5">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[13px] font-bold text-gray-500 tracking-tight">แต้มที่มีปัจจุบัน</span>
                  <span className="text-[14px] font-bold text-gray-800">{balance.toLocaleString()} P</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[13px] font-bold text-gray-500 tracking-tight">ใช้คะแนนครั้งนี้</span>
                  <span className="text-[14px] font-bold text-red-500">-{reward.point_cost.toLocaleString()} P</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-[14px] font-extrabold text-gray-900 tracking-tight">คงเหลือหลังแลกรับ</span>
                  <span className="text-[15px] font-extrabold text-[var(--jh-green)]">
                    {(balance - reward.point_cost).toLocaleString()} P
                  </span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center mb-4">
                  <p className="text-sm font-semibold text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleRedeem}
                disabled={redeeming}
                className="w-full rounded-[24px] bg-[var(--jh-green)] hover:bg-[#3da342] py-4 text-[16px] font-bold text-white disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-[var(--jh-green)]/30"
              >
                {redeeming ? "กำลังดำเนินการ..." : "ยืนยันแลกแต้ม"}
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Address Selector Modal */}
      {showAddressSelector && !showAddressForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] rounded-b-none sm:rounded-b-[24px] border-0 shadow-2xl bg-gray-50 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-white p-4 flex justify-between items-center border-b border-gray-100 shrink-0 sticky top-0 z-10">
              <h3 className="text-[16px] font-extrabold text-gray-900">เลือกที่อยู่จัดส่ง</h3>
              <button onClick={() => setShowAddressSelector(false)} className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <CardContent className="p-4 overflow-y-auto flex-1 space-y-3 relative">
              {savedAddresses.length === 0 ? (
                 <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
                   <p className="text-gray-500 font-medium">ไม่มีที่อยู่จัดส่งในระบบ</p>
                 </div>
              ) : (
                savedAddresses.map((addr) => (
                  <div key={addr.id} onClick={() => { setSelectedAddressId(addr.id); setShowAddressSelector(false); }} className={`cursor-pointer rounded-2xl border ${selectedAddressId === addr.id ? 'border-[var(--jh-green)] bg-green-50/30 ring-1 ring-[var(--jh-green)]' : 'border-gray-200 bg-white hover:border-gray-300'} p-4 relative shadow-sm transition-all`}>
                    <div className="flex items-start gap-3">
                       <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedAddressId === addr.id ? 'border-[var(--jh-green)] bg-[var(--jh-green)]' : 'border-gray-300'}`}>
                         {selectedAddressId === addr.id && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-white"><path d="M20 6L9 17l-5-5"/></svg>}
                       </div>
                       <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                           <h4 className="font-bold text-[14px] text-gray-900">{addr.recipient_name}</h4>
                           <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{addr.phone}</span>
                         </div>
                         <p className="text-[12px] text-gray-600 leading-relaxed pr-2">{formatAddress(addr)}</p>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
               <button onClick={() => { setAddressForm({ ...emptyAddressForm, recipient_name: profilePrefill?.name || "", phone: profilePrefill?.phone || "" }); setShowAddressForm(true); }} className="w-full rounded-[24px] border-2 border-[var(--jh-green)] bg-white hover:bg-green-50 py-3.5 text-[14px] font-bold text-[var(--jh-green)] shadow-sm">
                 + เพิ่มที่อยู่ใหม่
               </button>
            </div>
          </Card>
        </div>
      )}

      {/* New Address Form Modal */}
      {showAddressForm && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] rounded-b-none sm:rounded-b-[24px] border-0 shadow-2xl bg-white overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-white p-4 flex justify-between items-center border-b border-gray-100 shrink-0 sticky top-0 z-10">
              <h3 className="text-[16px] font-extrabold text-gray-900">ที่อยู่จัดส่งใหม่</h3>
              <button onClick={() => setShowAddressForm(false)} className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <CardContent className="p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 gap-3">
                <input value={addressForm.recipient_name} onChange={(e) => setAddressForm((prev) => ({ ...prev, recipient_name: e.target.value }))} placeholder="ชื่อผู้รับ *" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 focus:ring-[var(--jh-green)] transition-all bg-white" />
                <input value={addressForm.phone} onChange={(e) => setAddressForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="เบอร์โทร *" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 focus:ring-[var(--jh-green)] transition-all bg-white" />
                <input value={addressForm.address_line1} onChange={(e) => setAddressForm((prev) => ({ ...prev, address_line1: e.target.value }))} placeholder="ที่อยู่ (เลขที่, ซอย, ถนน) *" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 focus:ring-[var(--jh-green)] transition-all bg-white" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={addressForm.sub_district} onChange={(e) => setAddressForm((prev) => ({ ...prev, sub_district: e.target.value }))} placeholder="แขวง/ตำบล" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 focus:ring-[var(--jh-green)] transition-all bg-white" />
                  <input value={addressForm.district} onChange={(e) => setAddressForm((prev) => ({ ...prev, district: e.target.value }))} placeholder="เขต/อำเภอ" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 focus:ring-[var(--jh-green)] transition-all bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={addressForm.province} onChange={(e) => setAddressForm((prev) => ({ ...prev, province: e.target.value }))} placeholder="จังหวัด" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 focus:ring-[var(--jh-green)] transition-all bg-white" />
                  <input value={addressForm.postal_code} onChange={(e) => setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))} placeholder="รหัสไปรษณีย์" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 focus:ring-[var(--jh-green)] transition-all bg-white" />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs font-bold mt-3 text-center">{error}</p>}
            </CardContent>
            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
               <button onClick={handleSaveNewAddress} className="w-full rounded-[24px] bg-[var(--jh-green)] hover:bg-[#3da342] py-4 text-[15px] font-bold text-white shadow-md transition-all active:scale-[0.98]">
                 บันทึกที่อยู่ และใช้งาน
               </button>
            </div>
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
