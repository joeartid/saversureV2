-- Seed default page_configs for history sub-pages
-- Idempotent: ON CONFLICT DO NOTHING skips tenants that already have configs
-- (e.g. created manually via /page-builder admin UI)

-- ================================================================
-- 1. history_redeems — ประวัติแลกของรางวัล (สินค้า/จัดส่ง)
-- ================================================================
INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
SELECT t.id, 'history_redeems', '[
  {
    "id": "redeems-header-default",
    "type": "section_header",
    "order": 1,
    "visible": true,
    "props": {
      "variant": "gradient",
      "decoration": "circles",
      "title_size": "lg",
      "title": "ประวัติแลกของรางวัล",
      "subtitle": "สินค้าและของจัดส่ง"
    }
  },
  {
    "id": "redeems-tabs-default",
    "type": "history_tabs_nav",
    "order": 2,
    "visible": true,
    "props": {
      "overlap": true
    }
  },
  {
    "id": "redeems-list-default",
    "type": "history_redeems_list",
    "order": 3,
    "visible": true,
    "props": {
      "empty_title": "ยังไม่มีประวัติการแลกรางวัล",
      "empty_text": "สะสมแต้มเพื่อนำมาแลกของรางวัลและสิทธิพิเศษ",
      "empty_cta_label": "ดูของรางวัล",
      "empty_cta_link": "/rewards",
      "error_title": "ไม่สามารถโหลดข้อมูลได้",
      "error_text": "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      "retry_label": "ลองใหม่"
    }
  }
]'::jsonb, 'published', 1
FROM tenants t
ON CONFLICT (tenant_id, page_slug) DO NOTHING;

-- ================================================================
-- 2. history_coupons — คูปองของฉัน (คูปอง/ดิจิทัล/ตั๋ว)
-- ================================================================
INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
SELECT t.id, 'history_coupons', '[
  {
    "id": "coupons-header-default",
    "type": "section_header",
    "order": 1,
    "visible": true,
    "props": {
      "variant": "gradient",
      "decoration": "circles",
      "title_size": "lg",
      "title": "คูปองของฉัน",
      "subtitle": "คูปอง ตั๋ว และสิทธิ์ดิจิทัล"
    }
  },
  {
    "id": "coupons-tabs-default",
    "type": "history_tabs_nav",
    "order": 2,
    "visible": true,
    "props": {
      "overlap": true
    }
  },
  {
    "id": "coupons-list-default",
    "type": "history_coupons_list",
    "order": 3,
    "visible": true,
    "props": {
      "empty_title": "ยังไม่มีคูปองหรือสิทธิ์ดิจิทัล",
      "empty_text": "แลกแต้มเพื่อรับคูปอง ตั๋ว หรือของรางวัลดิจิทัลที่หน้ารางวัล",
      "empty_cta_label": "ไปที่หน้ารางวัล",
      "empty_cta_link": "/rewards",
      "error_title": "ไม่สามารถโหลดข้อมูลได้",
      "error_text": "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      "retry_label": "ลองใหม่",
      "active_section_label": "ใช้ได้",
      "used_section_label": "ใช้แล้ว / หมดอายุ"
    }
  }
]'::jsonb, 'published', 1
FROM tenants t
ON CONFLICT (tenant_id, page_slug) DO NOTHING;

-- ================================================================
-- 3. history_lucky_draw — ประวัติลุ้นโชค
-- ================================================================
INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
SELECT t.id, 'history_lucky_draw', '[
  {
    "id": "lucky-draw-header-default",
    "type": "section_header",
    "order": 1,
    "visible": true,
    "props": {
      "variant": "gradient",
      "decoration": "circles",
      "title_size": "lg",
      "title": "ประวัติลุ้นโชค",
      "subtitle": "ประวัติการร่วมสนุกกิจกรรมต่างๆ"
    }
  },
  {
    "id": "lucky-draw-tabs-default",
    "type": "history_tabs_nav",
    "order": 2,
    "visible": true,
    "props": {
      "overlap": true
    }
  },
  {
    "id": "lucky-draw-list-default",
    "type": "history_lucky_draw_list",
    "order": 3,
    "visible": true,
    "props": {
      "empty_title": "ยังไม่มีสิทธิ์ลุ้นโชค",
      "empty_text": "ร่วมกิจกรรมลุ้นโชคเพื่อรับสิทธิ์",
      "empty_cta_label": "ดูกิจกรรม",
      "empty_cta_link": "/missions",
      "error_title": "ไม่สามารถโหลดข้อมูลได้",
      "error_text": "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      "retry_label": "ลองใหม่",
      "count_label": "พบ {n} สิทธิ์ลุ้นโชค",
      "status_label_active": "รอการจับรางวัล",
      "status_label_won": "ได้รับรางวัล",
      "ticket_number_label": "หมายเลขตั๋ว",
      "ticket_type_label": "ตั๋ว"
    }
  }
]'::jsonb, 'published', 1
FROM tenants t
ON CONFLICT (tenant_id, page_slug) DO NOTHING;
