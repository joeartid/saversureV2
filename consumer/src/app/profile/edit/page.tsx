"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  profile_completed?: boolean;
  phone_verified?: boolean;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    display_name: ""
  });
  const [originalPhone, setOriginalPhone] = useState<string | null>(null);
  const { toast } = useToast();

  // ดึงข้อมูลโปรไฟล์เดิม
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get<ProfileData>("/api/v1/profile");
        setFormData({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          display_name: data.display_name || ""
        });
        setOriginalPhone(data.phone || null);
      } catch (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้",
          variant: "destructive"
        });
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, [toast]);

  // จัดการการเปลี่ยนแปลงข้อมูลฟอร์ม
  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  // บันทึกข้อมูล
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ส่งเฉพาะฟิลด์ที่มีการเปลี่ยนแปลง
      const updateData: any = {};
      if (formData.first_name.trim()) updateData.first_name = formData.first_name.trim();
      if (formData.last_name.trim()) updateData.last_name = formData.last_name.trim();
      if (formData.display_name.trim()) updateData.display_name = formData.display_name.trim();

      await api.patch("/api/v1/profile", updateData);
      
      toast({
        title: "บันทึกสำเร็จ",
        description: "ข้อมูลส่วนตัวของคุณได้รับการอัปเดตแล้ว"
      });
      
      router.push("/profile");
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />
      <div className="pt-24">
        <PageHeader title="ข้อมูลส่วนตัว" subtitle="แก้ไขข้อมูลส่วนตัวของคุณ" backHref="/profile" />

      <div className="px-4 mt-6">
        {fetching ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--jh-green)] mx-auto mb-4"></div>
              <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">ชื่อที่แสดง</Label>
                  <Input 
                    id="displayName" 
                    value={formData.display_name}
                    onChange={handleChange("display_name")}
                    placeholder="ชื่อที่จะแสดงในโปรไฟล์" 
                    className="bg-gray-50 focus-visible:ring-[var(--jh-green)]" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstName">ชื่อจริง</Label>
                  <Input 
                    id="firstName" 
                    value={formData.first_name}
                    onChange={handleChange("first_name")}
                    placeholder="ชื่อจริงของคุณ" 
                    className="bg-gray-50 focus-visible:ring-[var(--jh-green)]" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">นามสกุล</Label>
                  <Input 
                    id="lastName" 
                    value={formData.last_name}
                    onChange={handleChange("last_name")}
                    placeholder="นามสกุลของคุณ" 
                    className="bg-gray-50 focus-visible:ring-[var(--jh-green)]" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">อีเมล</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email}
                    disabled
                    placeholder="example@email.com" 
                    className="bg-gray-100 text-gray-500" 
                  />
                  <p className="text-xs text-gray-500">ไม่สามารถแก้ไขอีเมลได้ในหน้านี้</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">เบอร์โทรศัพท์ (ยืนยันแล้ว)</Label>
                  <Input 
                    id="phone" 
                    value={originalPhone || "08X-XXX-XXXX"} 
                    disabled 
                    className="bg-gray-100 text-gray-500 font-mono" 
                  />
                  <p className="text-xs text-gray-500">ไม่สามารถแก้ไขเบอร์โทรศัพท์ได้ในหน้านี้</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-[var(--jh-green)] hover:bg-[var(--jh-green-dark)] rounded-xl py-6 text-md shadow-md"
                >
                  {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
      <BottomNav />
    </div>
  );
}
