-- Seed default page_config for /settings page
-- Idempotent: ON CONFLICT DO NOTHING skips tenants that already have a config

INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
SELECT t.id, 'settings', '[
  {
    "id": "settings-header-default",
    "type": "settings_page_header",
    "order": 1,
    "visible": true,
    "props": {
      "title": "การตั้งค่าแอปพลิเคชัน",
      "subtitle": "จัดการการแจ้งเตือนและความเป็นส่วนตัว",
      "back_href": "/profile"
    }
  },
  {
    "id": "settings-notifications-default",
    "type": "settings_notifications_group",
    "order": 2,
    "visible": true,
    "props": {
      "group_title": "การแจ้งเตือน (Push Notifications)",
      "items": [
        {
          "label": "แต้มและภารกิจ",
          "description": "แจ้งเตือนเมื่อแต้มเข้าสำเร็จ หรือภารกิจบรรลุเป้าหมาย",
          "default_on": true,
          "locked": false
        },
        {
          "label": "ข่าวสารและโปรโมชัน",
          "description": "รับส่วนลดพิเศษ สิทธิพิเศษ และแคมเปญใหม่ๆ ก่อนใคร",
          "default_on": true,
          "locked": false
        },
        {
          "label": "ระบบและความปลอดภัย",
          "description": "ห้ามปิด หากต้องการรับรู้ความเคลื่อนไหวสำคัญของบัญชี",
          "default_on": true,
          "locked": true
        }
      ]
    }
  },
  {
    "id": "settings-delete-default",
    "type": "settings_delete_account_card",
    "order": 3,
    "visible": true,
    "props": {
      "group_title": "ลบบัญชีผู้ใช้",
      "button_label": "แจ้งขอลบบัญชีผู้ใช้",
      "warning_text": "หากลบบัญชี แต้มและข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้",
      "cta_href": ""
    }
  },
  {
    "id": "settings-version-default",
    "type": "settings_app_version_footer",
    "order": 4,
    "visible": true,
    "props": {
      "text": "APP VERSION 2.0.1 (Build 491)"
    }
  }
]'::jsonb, 'published', 1
FROM tenants t
ON CONFLICT (tenant_id, page_slug) DO NOTHING;
