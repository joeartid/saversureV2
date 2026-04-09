-- Seed default page_config for /support/faq page (Phase 9c)
-- Preserves the 3 original hardcoded FAQs from the old page 1:1
-- Idempotent: ON CONFLICT DO NOTHING

INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
SELECT t.id, 'support_faq', '[
  {
    "id": "support-faq-header-default",
    "type": "section_header",
    "order": 1,
    "visible": true,
    "props": {
      "variant": "basic",
      "title": "ศูนย์ช่วยเหลือ",
      "subtitle": "คำถามที่พบบ่อย (FAQ)",
      "back_href": "/support"
    }
  },
  {
    "id": "support-faq-list-default",
    "type": "support_faq_list",
    "order": 2,
    "visible": true,
    "props": {
      "empty_text": "ยังไม่มีคำถามที่พบบ่อย",
      "items": [
        {
          "q": "แต้มมีวันหมดอายุหรือไม่?",
          "a": "แต้มสะสมมีอายุ 1 ปีปฏิทิน และจะหมดอายุในวันที่ 31 ธันวาคมของปีถัดไปจากการสะสม"
        },
        {
          "q": "สแกนคิวอาร์โค้ดแล้วแต้มไม่ขึ้น ทำอย่างไร?",
          "a": "เบื้องต้นโปรดตรวจสอบสัญญาณอินเทอร์เน็ต และลองสแกนอีกครั้ง หากยังไม่สำเร็จ โปรดกดที่เมนู ''แจ้งปัญหาการใช้งาน''"
        },
        {
          "q": "ของรางวัลจัดส่งเมื่อไหร่?",
          "a": "ของรางวัลจะถูกจัดส่งภายใน 7-14 วันทำการหลังจากการแลกคะแนนสำเร็จ"
        }
      ]
    }
  },
  {
    "id": "support-faq-contact-cta-default",
    "type": "support_contact_cta",
    "order": 3,
    "visible": true,
    "props": {
      "text": "ไม่พบคำตอบที่ต้องการ? ติดต่อหน่วยงานบริการลูกค้าเพื่อสอบถามเพิ่มเติม",
      "cta_label": "แจ้งปัญหาการใช้งาน",
      "cta_href": "/support/history?tab=ticket"
    }
  }
]'::jsonb, 'published', 1
FROM tenants t
ON CONFLICT (tenant_id, page_slug) DO NOTHING;
