"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import PageRenderer from "@/components/PageRenderer";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

function SettingsFallback() {
  const [notifyPromo, setNotifyPromo] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);
  const [notifyPoints, setNotifyPoints] = useState(true);

  return (
    <>
      <PageHeader title="การตั้งค่าแอปพลิเคชัน" subtitle="จัดการการแจ้งเตือนและความเป็นส่วนตัว" backHref="/profile" />

      <div className="px-4 mt-6 space-y-4">
        <div>
          <h2 className="text-[14px] font-bold text-gray-800 mb-2 ml-2">การแจ้งเตือน (Push Notifications)</h2>
          <Card className="border-0 shadow-sm divide-y divide-gray-50">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <div className="pr-4">
                  <p className="text-[14px] font-medium text-gray-800">แต้มและภารกิจ</p>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">แจ้งเตือนเมื่อแต้มเข้าสำเร็จ หรือภารกิจบรรลุเป้าหมาย</p>
                </div>
                <Switch checked={notifyPoints} onCheckedChange={setNotifyPoints} />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="pr-4">
                  <p className="text-[14px] font-medium text-gray-800">ข่าวสารและโปรโมชัน</p>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">รับส่วนลดพิเศษ สิทธิพิเศษ และแคมเปญใหม่ๆ ก่อนใคร</p>
                </div>
                <Switch checked={notifyPromo} onCheckedChange={setNotifyPromo} />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="pr-4">
                  <p className="text-[14px] font-medium text-gray-800">ระบบและความปลอดภัย</p>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">ห้ามปิด หากต้องการรับรู้ความเคลื่อนไหวสำคัญของบัญชี</p>
                </div>
                <Switch checked={notifySystem} disabled onCheckedChange={setNotifySystem} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-[14px] font-bold text-gray-800 mb-2 ml-2 mt-2">ลบบัญชีผู้ใช้</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-1">
              <button className="w-full flex items-center justify-between p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-red-50 p-2 rounded-lg text-red-500">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </div>
                  <span className="text-[14px] font-bold">แจ้งขอลบบัญชีผู้ใช้</span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-red-300"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </CardContent>
          </Card>
          <p className="text-[11px] text-gray-400 mt-2 ml-2 px-1">หากลบบัญชี แต้มและข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้</p>
        </div>

        <div className="text-center pt-8">
          <p className="text-[10px] text-gray-300 font-mono">APP VERSION 2.0.1 (Build 491)</p>
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />
      <div className="pt-24">
        <PageRenderer pageSlug="settings" fallback={<SettingsFallback />} />
      </div>
      <BottomNav />
    </div>
  );
}
