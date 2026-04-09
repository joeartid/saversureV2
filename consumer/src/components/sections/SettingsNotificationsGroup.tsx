"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface ToggleItem {
  label?: string;
  description?: string;
  default_on?: boolean;
  locked?: boolean;
}

interface SettingsNotificationsGroupProps {
  group_title?: string;
  items?: ToggleItem[];
}

export default function SettingsNotificationsGroup({
  group_title = "การแจ้งเตือน (Push Notifications)",
  items = [],
}: SettingsNotificationsGroupProps) {
  const [state, setState] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    items.forEach((it, i) => {
      init[i] = it.default_on ?? true;
    });
    return init;
  });

  if (!items.length) return null;

  return (
    <div className="px-4 mt-6">
      <h2 className="text-[14px] font-bold text-gray-800 mb-2 ml-2">
        {group_title}
      </h2>
      <Card className="border-0 shadow-sm divide-y divide-gray-50">
        <CardContent className="p-0">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="pr-4">
                <p className="text-[14px] font-medium text-gray-800">
                  {it.label}
                </p>
                {it.description && (
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                    {it.description}
                  </p>
                )}
              </div>
              <Switch
                checked={state[i] ?? it.default_on ?? true}
                disabled={it.locked}
                onCheckedChange={(v) =>
                  setState((prev) => ({ ...prev, [i]: v }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
