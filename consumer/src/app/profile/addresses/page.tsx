"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  id?: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  district: string;
  sub_district: string;
  province: string;
  postal_code: string;
  is_default: boolean;
}

const emptyForm: AddressFormState = {
  label: "home",
  recipient_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  district: "",
  sub_district: "",
  province: "",
  postal_code: "",
  is_default: false,
};

export default function AddressBookPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<AddressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<AddressFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [profilePrefill, setProfilePrefill] = useState<{name: string, phone: string} | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const [res, profRes] = await Promise.all([
        api.get<{ data: AddressEntry[] }>("/api/v1/profile/addresses"),
        api.get<any>("/api/v1/profile").catch(() => null)
      ]);
      setAddresses(res.data || []);
      if (profRes) {
        setProfilePrefill({
          name: [profRes.first_name, profRes.last_name].filter(Boolean).join(" "),
          phone: profRes.phone || ""
        });
      }
    } catch (error: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถดึงข้อมูลที่อยู่ได้", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr: AddressEntry) => {
    return [addr.address_line1, addr.address_line2, addr.sub_district, addr.district, addr.province, addr.postal_code]
      .filter(Boolean)
      .join(" ");
  };

  const handleEdit = (addr: AddressEntry) => {
    setFormValues({
      id: addr.id,
      label: addr.label || "home",
      recipient_name: addr.recipient_name,
      phone: addr.phone,
      address_line1: addr.address_line1,
      address_line2: addr.address_line2 || "",
      district: addr.district || "",
      sub_district: addr.sub_district || "",
      province: addr.province || "",
      postal_code: addr.postal_code || "",
      is_default: addr.is_default,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formValues.recipient_name.trim() || !formValues.phone.trim() || !formValues.address_line1.trim()) {
      toast({ title: "ข้อมูลไม่ครบถ้วน", description: "กรุณากรอก ชื่อผู้รับ เบอร์โทร และที่อยู่ ให้ครบ", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: formValues.label,
        recipient_name: formValues.recipient_name.trim(),
        phone: formValues.phone.trim(),
        address_line1: formValues.address_line1.trim(),
        address_line2: formValues.address_line2.trim() || undefined,
        district: formValues.district.trim() || undefined,
        sub_district: formValues.sub_district.trim() || undefined,
        province: formValues.province.trim() || undefined,
        postal_code: formValues.postal_code.trim() || undefined,
        is_default: formValues.is_default || addresses.length === 0,
      };

      if (formValues.id) {
        await api.patch(`/api/v1/profile/addresses/${formValues.id}`, payload);
        toast({ title: "สำเร็จ", description: "อัปเดตข้อมูลที่อยู่แล้ว" });
      } else {
        await api.post("/api/v1/profile/addresses", payload);
        toast({ title: "สำเร็จ", description: "เพิ่มที่อยู่ใหม่แล้ว" });
      }
      setShowForm(false);
      setFormValues(emptyForm);
      fetchAddresses();
    } catch (error: any) {
      toast({ title: "บันทึกไม่สำเร็จ", description: error.message || "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, is_default: boolean) => {
    if (is_default && addresses.length > 1) {
      toast({ title: "ไม่สามารถลบได้", description: "กรุณาตั้งที่อยู่อื่นเป็นค่าเริ่มต้นก่อนลบที่อยู่นี้", variant: "destructive" });
      return;
    }
    if (!confirm("ยืนยันการลบที่อยู่นี้?")) return;
    try {
      await api.delete(`/api/v1/profile/addresses/${id}`);
      toast({ title: "สำเร็จ", description: "ลบที่อยู่แล้ว" });
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      toast({ title: "ลบไม่สำเร็จ", description: err.message || "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/api/v1/profile/addresses/${id}/default`, {});
      toast({ title: "สำเร็จ", description: "ตั้งเป็นที่อยู่จัดส่งหลักแล้ว" });
      fetchAddresses();
    } catch (err: any) {
      toast({ title: "ผิดพลาด", description: err.message || "ไม่สามารถตั้งค่าได้", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />

      <div className="pt-24">
        <PageHeader title="สมุดที่อยู่จัดส่ง" subtitle="จัดการที่อยู่สำหรับการจัดส่งของรางวัล" backHref="/profile" />

        <div className="px-4 mt-6">
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--jh-green)] mx-auto mb-4"></div>
              <p className="text-gray-500 text-sm font-medium">กำลังโหลดที่อยู่...</p>
            </div>
          ) : showForm ? (
            <Card className="border-0 shadow-sm rounded-[24px]">
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-5 border-b pb-3">
                  <h3 className="text-base font-extrabold text-gray-800">{formValues.id ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่ใหม่"}</h3>
                  <button onClick={() => { setShowForm(false); setFormValues(emptyForm); }} className="p-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <input value={formValues.recipient_name} onChange={(e) => setFormValues(p => ({ ...p, recipient_name: e.target.value }))} placeholder="ชื่อผู้รับ *" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 transition-all bg-white" />
                    <input value={formValues.phone} onChange={(e) => setFormValues(p => ({ ...p, phone: e.target.value }))} placeholder="เบอร์โทร *" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 transition-all bg-white" />
                    <input value={formValues.address_line1} onChange={(e) => setFormValues(p => ({ ...p, address_line1: e.target.value }))} placeholder="ที่อยู่ (เลขที่, ซอย, ถนน) *" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 transition-all bg-white" />
                    <div className="grid grid-cols-2 gap-3">
                      <input value={formValues.sub_district} onChange={(e) => setFormValues(p => ({ ...p, sub_district: e.target.value }))} placeholder="แขวง/ตำบล" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 transition-all bg-white" />
                      <input value={formValues.district} onChange={(e) => setFormValues(p => ({ ...p, district: e.target.value }))} placeholder="เขต/อำเภอ" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 transition-all bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={formValues.province} onChange={(e) => setFormValues(p => ({ ...p, province: e.target.value }))} placeholder="จังหวัด" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 transition-all bg-white" />
                      <input value={formValues.postal_code} onChange={(e) => setFormValues(p => ({ ...p, postal_code: e.target.value }))} placeholder="รหัสไปรษณีย์" className="w-full rounded-[24px] border border-gray-200 px-5 py-3.5 text-[14px] outline-none focus:border-[var(--jh-green)] focus:ring-1 transition-all bg-white" />
                    </div>
                  </div>

                  {!formValues.is_default && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer p-2 opacity-80 hover:opacity-100">
                      <input type="checkbox" checked={formValues.is_default} onChange={(e) => setFormValues(p => ({ ...p, is_default: e.target.checked }))} className="w-4 h-4 text-[var(--jh-green)] rounded focus:ring-0" />
                      <span className="text-sm font-medium text-gray-700">ตั้งเป็นที่อยู่จัดส่งหลัก</span>
                    </label>
                  )}

                  <Button onClick={handleSave} disabled={saving} className="w-full rounded-[24px] bg-[var(--jh-green)] hover:bg-[#3da342] py-6 mt-4 text-[15px] font-bold text-white shadow-md">
                    {saving ? "กำลังบันทึก..." : "บันทึกที่อยู่"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {addresses.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
                  <span className="text-4xl mb-3 block">🏡</span>
                  <p className="text-gray-500 font-medium">ยังไม่มีที่อยู่จัดส่ง</p>
                  <p className="text-xs text-gray-400 mt-1">เพิ่มที่อยู่เพื่อให้การแลกรางวัลสะดวกขึ้น</p>
                </div>
              ) : (
                addresses.map((addr) => (
                  <Card key={addr.id} className={`border ${addr.is_default ? 'border-[var(--jh-green)] bg-green-50/20' : 'border-gray-100'} shadow-sm rounded-[20px] overflow-hidden`}>
                    {addr.is_default && <div className="h-1 w-full bg-[var(--jh-green)]" />}
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[15px] text-gray-900">{addr.recipient_name}</h4>
                          {addr.is_default && <Badge className="bg-[var(--jh-green)]/10 text-[var(--jh-green)] border-0 text-[10px] px-2 py-0.5">ค่าเริ่มต้น</Badge>}
                        </div>
                        <span className="text-[13px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{addr.phone}</span>
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed mb-4">{formatAddress(addr)}</p>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(addr)} className="text-[12px] font-bold text-[var(--jh-green)] hover:underline px-2 py-1">แก้ไข</button>
                          <button onClick={() => handleDelete(addr.id, addr.is_default)} className="text-[12px] font-bold text-red-500 hover:underline px-2 py-1">ลบ</button>
                        </div>
                        {!addr.is_default && (
                          <button onClick={() => handleSetDefault(addr.id)} className="text-[12px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors border border-gray-200">
                            ตั้งเป็นค่าเริ่มต้น
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              <Button onClick={() => {
                setFormValues({
                  ...emptyForm,
                  recipient_name: profilePrefill?.name || "",
                  phone: profilePrefill?.phone || ""
                });
                setShowForm(true);
              }} className="w-full rounded-[24px] border-2 border-[var(--jh-green)] bg-white hover:bg-green-50 py-6 text-[15px] font-bold text-[var(--jh-green)] shadow-sm">
                + เพิ่มที่อยู่ใหม่
              </Button>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
