-- ==============================================
-- CMS Mock Data for Jula's Herb (JulasHerb)
-- Tenant ID: 00000000-0000-0000-0000-000000000001
-- ==============================================

-- ========== 1. HOME PAGE CONFIG ==========
INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'home',
  '[
    {
      "id": "hero-main",
      "type": "hero_banner",
      "order": 1,
      "visible": true,
      "props": {
        "title": "Jula''s Herb",
        "subtitle": "à¸ªà¹à¸à¸™ QR à¸ªà¸°à¸ªà¸¡à¹à¸•à¹‰à¸¡ à¹à¸¥à¸à¸‚à¸­à¸‡à¸£à¸²à¸‡à¸§à¸±à¸¥à¸ªà¸¸à¸”à¸žà¸´à¹€à¸¨à¸©",
        "image_url": "https://api.svsu.me/media/saversure-dev/upload/images/2026/03/1772427898466-7a999a78-bd08-44d0-b239-603cbd0e97e1.jpg",
        "cta_text": "à¸ªà¹à¸à¸™à¹€à¸¥à¸¢",
        "cta_link": "/scan"
      }
    },
    {
      "id": "points-card",
      "type": "points_summary",
      "order": 2,
      "visible": true,
      "props": {
        "show_greeting": true
      }
    },
    {
      "id": "quick-menu",
      "type": "feature_menu",
      "order": 3,
      "visible": true,
      "props": {
        "columns": 4,
        "items": [
          {"icon": "scan", "label": "à¸ªà¹à¸à¸™ QR", "link": "/scan"},
          {"icon": "gift", "label": "à¹à¸¥à¸à¸£à¸²à¸‡à¸§à¸±à¸¥", "link": "/rewards"},
          {"icon": "history", "label": "à¸›à¸£à¸°à¸§à¸±à¸•à¸´", "link": "/history"},
          {"icon": "trophy", "label": "à¸à¸£à¸°à¹€à¸›à¹‹à¸²à¹€à¸‡à¸´à¸™", "link": "/wallet"}
        ]
      }
    },
    {
      "id": "promo-march",
      "type": "promo_banner",
      "order": 4,
      "visible": true,
      "props": {
        "title": "à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™à¹€à¸”à¸·à¸­à¸™à¸¡à¸µà¸™à¸²à¸„à¸¡",
        "description": "à¸ªà¹à¸à¸™à¸ªà¸´à¸™à¸„à¹‰à¸² JDENT Extra Care à¸£à¸±à¸š Diamond ðŸ’Ž à¹€à¸žà¸´à¹ˆà¸¡à¸—à¸±à¸™à¸—à¸µ!",
        "emoji": "ðŸŽ‰",
        "link": "/rewards",
        "bg_color": "linear-gradient(135deg, #1a9444 0%, #94c945 100%)"
      }
    },
    {
      "id": "banner-slides",
      "type": "banner_carousel",
      "order": 5,
      "visible": true,
      "props": {
        "auto_play": true,
        "interval_ms": 4000,
        "items": [
          {
            "image_url": "https://api.svsu.me/media/saversure-dev/upload/images/2026/01/Artboard 53-650c38ec-aa3d-484b-b798-5f8aff19b340.png",
            "alt": "à¹€à¸£à¸” à¸­à¸­à¹€à¸£à¹‰à¸™à¸ˆà¹Œ à¸à¸¥à¸¹à¸•à¹‰à¸² à¸šà¸¹à¸ªà¹€à¸•à¸­à¸£à¹Œ à¹€à¸‹à¸£à¸±à¹ˆà¸¡ â€” à¸œà¸´à¸§à¸à¸£à¸°à¸ˆà¹ˆà¸²à¸‡à¹ƒà¸ªà¸£à¸°à¸”à¸±à¸šà¹€à¸‹à¸£à¸±à¹ˆà¸¡à¹€à¸‚à¹‰à¸¡à¸‚à¹‰à¸™",
            "link": "/rewards"
          },
          {
            "image_url": "https://api.svsu.me/media/saversure-dev/upload/images/2026/01/Artboard 51-2d13ad42-8499-4543-8d29-49443a5f2a79.png",
            "alt": "à¸§à¸­à¹€à¸•à¸­à¸£à¹Œà¹€à¸¡à¸¥à¸­à¸™ EE à¸„à¸¹à¸Šà¸±à¹ˆà¸™ à¹à¸¡à¸•à¸•à¹Œ â€” à¸œà¸´à¸§à¸ªà¸§à¸¢à¹€à¸™à¸µà¸¢à¸™à¸à¸±à¸™à¹à¸”à¸”à¸ªà¸¹à¸‡ SPF50",
            "link": "/rewards"
          },
          {
            "image_url": "https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 31-5e92ad90-eac4-4f0b-ad93-4e91fc2e6165.png",
            "alt": "à¸§à¸­à¹€à¸•à¸­à¸£à¹Œà¹€à¸¡à¸¥à¸­à¸™ à¸‹à¸±à¸™à¸à¸²à¸£à¹Œà¸” â€” à¸›à¸à¸›à¹‰à¸­à¸‡à¸œà¸´à¸§à¸ˆà¸²à¸à¹à¸ªà¸‡à¹à¸”à¸” SPF50+",
            "link": "/rewards"
          },
          {
            "image_url": "https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 90-864abb26-dbec-480f-9af5-119e869f6827.png",
            "alt": "à¹à¸„à¸£à¸­à¸— à¸‹à¸µà¹à¸­à¸™à¸”à¹Œà¸­à¸µ à¹‚à¸‹à¸Ÿ â€” à¸šà¸³à¸£à¸¸à¸‡à¸œà¸´à¸§à¸­à¹ˆà¸­à¸™à¸™à¸¸à¹ˆà¸¡à¸Šà¸¸à¹ˆà¸¡à¸Šà¸·à¹‰à¸™",
            "link": "/rewards"
          }
        ]
      }
    },
    {
      "id": "spacer-1",
      "type": "spacer",
      "order": 6,
      "visible": true,
      "props": { "height": 8 }
    },
    {
      "id": "features-benefits",
      "type": "feature_list",
      "order": 7,
      "visible": true,
      "props": {
        "heading": "à¸—à¸³à¹„à¸¡à¸•à¹‰à¸­à¸‡à¸ªà¸°à¸ªà¸¡à¹à¸•à¹‰à¸¡à¸à¸±à¸š Jula''s Herb?",
        "items": [
          {
            "icon": "sparkle",
            "title": "à¸ªà¹à¸à¸™à¸‡à¹ˆà¸²à¸¢ à¹„à¸”à¹‰à¹à¸•à¹‰à¸¡à¸—à¸±à¸™à¸—à¸µ",
            "description": "à¸ªà¹à¸à¸™ QR Code à¸šà¸™à¸ªà¸´à¸™à¸„à¹‰à¸² à¸£à¸±à¸šà¸„à¸°à¹à¸™à¸™à¸ªà¸°à¸ªà¸¡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´ à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹€à¸à¹‡à¸šà¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆ"
          },
          {
            "icon": "bolt",
            "title": "à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™à¸žà¸´à¹€à¸¨à¸©à¹€à¸‰à¸žà¸²à¸°à¸ªà¸¡à¸²à¸Šà¸´à¸",
            "description": "à¸¥à¸¸à¹‰à¸™à¸£à¸±à¸šà¹à¸•à¹‰à¸¡à¹€à¸žà¸´à¹ˆà¸¡ Diamond ðŸ’Ž à¹à¸¥à¸°à¸£à¸²à¸‡à¸§à¸±à¸¥à¸žà¸´à¹€à¸¨à¸©à¸ˆà¸²à¸à¹à¸„à¸¡à¹€à¸›à¸à¸›à¸£à¸°à¸ˆà¸³à¹€à¸”à¸·à¸­à¸™"
          },
          {
            "icon": "shield",
            "title": "à¹à¸¥à¸à¸‚à¸­à¸‡à¸£à¸²à¸‡à¸§à¸±à¸¥à¹„à¸”à¹‰à¸ˆà¸£à¸´à¸‡",
            "description": "à¹ƒà¸Šà¹‰à¹à¸•à¹‰à¸¡à¹à¸¥à¸à¸ªà¸´à¸™à¸„à¹‰à¸²à¸ˆà¸¸à¸¬à¸²à¹€à¸®à¸´à¸£à¹Œà¸š à¸‚à¸­à¸‡à¸žà¸£à¸µà¹€à¸¡à¸µà¸¢à¸¡ à¸«à¸£à¸·à¸­à¸ªà¹ˆà¸§à¸™à¸¥à¸”à¸žà¸´à¹€à¸¨à¸© à¸ªà¹ˆà¸‡à¸–à¸¶à¸‡à¸šà¹‰à¸²à¸™"
          }
        ]
      }
    },
    {
      "id": "news-section",
      "type": "recent_news",
      "order": 8,
      "visible": true,
      "props": {
        "limit": 3,
        "show_image": true
      }
    },
    {
      "id": "how-to",
      "type": "rich_text",
      "order": 9,
      "visible": true,
      "props": {
        "title": "à¸§à¸´à¸˜à¸µà¸ªà¸°à¸ªà¸¡à¹à¸•à¹‰à¸¡",
        "content": "<div style=\"line-height:1.8\"><p><strong>à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸‡à¹ˆà¸²à¸¢à¹† 3 à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™:</strong></p><ol><li>ðŸ›’ à¸‹à¸·à¹‰à¸­à¸ªà¸´à¸™à¸„à¹‰à¸² Jula''s Herb à¸—à¸µà¹ˆà¸£à¹‰à¸²à¸™à¸„à¹‰à¸²à¸—à¸±à¹ˆà¸§à¹„à¸›</li><li>ðŸ“± à¸ªà¹à¸à¸™ QR Code à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¸šà¸™à¸à¸¥à¹ˆà¸­à¸‡à¸ªà¸´à¸™à¸„à¹‰à¸²</li><li>ðŸŽ à¸£à¸±à¸šà¸„à¸°à¹à¸™à¸™à¸ªà¸°à¸ªà¸¡à¸—à¸±à¸™à¸—à¸µ à¸™à¸³à¹„à¸›à¹à¸¥à¸à¸‚à¸­à¸‡à¸£à¸²à¸‡à¸§à¸±à¸¥à¹„à¸”à¹‰à¹€à¸¥à¸¢!</li></ol><p style=\"margin-top:12px;color:#666\">* à¸„à¸°à¹à¸™à¸™à¸ˆà¸°à¹€à¸‚à¹‰à¸²à¸£à¸°à¸šà¸šà¸—à¸±à¸™à¸—à¸µà¸«à¸¥à¸±à¸‡à¸ªà¹à¸à¸™ à¸ªà¸²à¸¡à¸²à¸£à¸–à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸¢à¸­à¸”à¹„à¸”à¹‰à¸—à¸µà¹ˆà¸«à¸™à¹‰à¸² <b>à¸à¸£à¸°à¹€à¸›à¹‹à¸²à¹€à¸‡à¸´à¸™</b></p></div>",
        "alignment": "left"
      }
    },
    {
      "id": "spacer-bottom",
      "type": "spacer",
      "order": 10,
      "visible": true,
      "props": { "height": 32 }
    }
  ]'::jsonb,
  'published',
  1
) ON CONFLICT (tenant_id, page_slug) DO UPDATE SET
  sections = EXCLUDED.sections,
  status = EXCLUDED.status,
  version = page_configs.version + 1,
  updated_at = NOW();


-- ========== 2. REWARDS PAGE CONFIG ==========
INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'rewards',
  '[
    {
      "id": "rewards-hero",
      "type": "hero_banner",
      "order": 1,
      "visible": true,
      "props": {
        "title": "à¹à¸¥à¸à¸‚à¸­à¸‡à¸£à¸²à¸‡à¸§à¸±à¸¥",
        "subtitle": "à¹ƒà¸Šà¹‰à¹à¸•à¹‰à¸¡à¸ªà¸°à¸ªà¸¡à¹à¸¥à¸à¸ªà¸´à¸™à¸„à¹‰à¸²à¸„à¸¸à¸“à¸ à¸²à¸žà¸ˆà¸²à¸ Jula''s Herb",
        "cta_text": "à¸”à¸¹à¹à¸•à¹‰à¸¡à¸‚à¸­à¸‡à¸‰à¸±à¸™",
        "cta_link": "/wallet"
      }
    },
    {
      "id": "rewards-points",
      "type": "points_summary",
      "order": 2,
      "visible": true,
      "props": { "show_greeting": false }
    },
    {
      "id": "rewards-promo",
      "type": "promo_banner",
      "order": 3,
      "visible": true,
      "props": {
        "title": "à¹à¸¥à¸à¸„à¸¸à¹‰à¸¡! à¸ªà¸´à¸™à¸„à¹‰à¸²à¹ƒà¸«à¸¡à¹ˆà¸›à¸£à¸°à¸ˆà¸³à¹€à¸”à¸·à¸­à¸™",
        "description": "à¸‹à¸±à¸™à¸Ÿà¸¥à¸²à¸§à¹€à¸§à¸­à¸£à¹Œ à¸‹à¸­à¸Ÿà¸—à¹Œ-à¹€à¸šà¸¥à¸­ à¸¢à¸¹à¸§à¸µ à¹€à¸ˆà¸¥ à¹ƒà¸Šà¹‰à¹€à¸žà¸µà¸¢à¸‡ 200 à¹à¸•à¹‰à¸¡",
        "emoji": "â˜€ï¸",
        "link": "/rewards",
        "bg_color": "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)"
      }
    }
  ]'::jsonb,
  'published',
  1
) ON CONFLICT (tenant_id, page_slug) DO UPDATE SET
  sections = EXCLUDED.sections,
  status = EXCLUDED.status,
  version = page_configs.version + 1,
  updated_at = NOW();


-- ========== 3. POPUPS ==========

-- Welcome popup
INSERT INTO popups (tenant_id, title, content, image_url, link_url, trigger_type, target_pages, frequency, priority, status, starts_at, ends_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'à¸¢à¸´à¸™à¸”à¸µà¸•à¹‰à¸­à¸™à¸£à¸±à¸šà¸ªà¸¹à¹ˆ Jula''s Herb Rewards!',
  '<div style="text-align:center"><h3 style="color:#1a9444;margin-bottom:8px">à¸ªà¸¡à¸²à¸Šà¸´à¸à¹ƒà¸«à¸¡à¹ˆ à¸£à¸±à¸šà¸ªà¸´à¸—à¸˜à¸´à¸žà¸´à¹€à¸¨à¸©</h3><p>à¸ªà¹à¸à¸™ QR Code à¸šà¸™à¸ªà¸´à¸™à¸„à¹‰à¸² à¸ªà¸°à¸ªà¸¡à¹à¸•à¹‰à¸¡ à¹à¸¥à¸à¸‚à¸­à¸‡à¸£à¸²à¸‡à¸§à¸±à¸¥à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ</p><p style="margin-top:12px;font-size:13px;color:#666">à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™à¸ªà¹à¸à¸™à¸ªà¸´à¸™à¸„à¹‰à¸²à¸Šà¸´à¹‰à¸™à¹à¸£à¸à¹€à¸¥à¸¢!</p></div>',
  NULL,
  '/scan',
  'on_load',
  '{home}',
  'once',
  10,
  'published',
  '2026-03-01T00:00:00+07:00',
  '2026-12-31T23:59:59+07:00'
);

-- March promo popup
INSERT INTO popups (tenant_id, title, content, image_url, link_url, trigger_type, target_pages, frequency, priority, status, starts_at, ends_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ðŸŽ‰ à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™ JDENT Extra Care',
  '<div style="text-align:center"><h3 style="color:#7c3aed;margin-bottom:8px">à¸ªà¹à¸à¸™à¸£à¸±à¸š Diamond ðŸ’Ž à¹€à¸žà¸´à¹ˆà¸¡!</h3><p>à¸‹à¸·à¹‰à¸­à¸ªà¸´à¸™à¸„à¹‰à¸² JDENT Extra Care à¸ªà¹à¸à¸™ QR Code à¸£à¸±à¸š Diamond à¹€à¸žà¸´à¹ˆà¸¡ <b>+10 ðŸ’Ž</b> à¸•à¹ˆà¸­à¸Šà¸´à¹‰à¸™</p><p style="margin-top:12px;font-size:13px;color:#666">à¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆà¸§à¸±à¸™à¸™à¸µà¹‰ â€“ 31 à¸¡à¸µà¸™à¸²à¸„à¸¡ 2569</p></div>',
  NULL,
  '/rewards',
  'on_load',
  '{home,scan}',
  'once_per_day',
  20,
  'published',
  '2026-03-01T00:00:00+07:00',
  '2026-03-31T23:59:59+07:00'
);

-- New product announcement popup
INSERT INTO popups (tenant_id, title, content, image_url, link_url, trigger_type, target_pages, frequency, priority, status, starts_at, ends_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ðŸŒ» à¸ªà¸´à¸™à¸„à¹‰à¸²à¹ƒà¸«à¸¡à¹ˆ! à¸‹à¸±à¸™à¸Ÿà¸¥à¸²à¸§à¹€à¸§à¸­à¸£à¹Œ à¸¢à¸¹à¸§à¸µ à¹€à¸ˆà¸¥',
  NULL,
  'https://api.svsu.me/media/saversure-dev/upload/images/2026/03/1772427898466-7a999a78-bd08-44d0-b239-603cbd0e97e1.jpg',
  '/rewards',
  'on_load',
  '{home,rewards}',
  'once_per_session',
  5,
  'published',
  '2026-03-01T00:00:00+07:00',
  '2026-04-30T23:59:59+07:00'
);


-- ========== 4. NAV MENUS ==========

-- Bottom Navigation
INSERT INTO nav_menus (tenant_id, menu_type, items)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'bottom_nav',
  '[
    {"icon": "home",    "label": "à¸«à¸™à¹‰à¸²à¹à¸£à¸",   "link": "/",         "visible": true},
    {"icon": "scan",    "label": "à¸ªà¹à¸à¸™",      "link": "/scan",     "visible": true},
    {"icon": "gift",    "label": "à¸£à¸²à¸‡à¸§à¸±à¸¥",    "link": "/rewards",  "visible": true},
    {"icon": "history", "label": "à¸›à¸£à¸°à¸§à¸±à¸•à¸´",   "link": "/history",  "visible": true},
    {"icon": "user",    "label": "à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œ",   "link": "/profile",  "visible": true}
  ]'::jsonb
) ON CONFLICT (tenant_id, menu_type) DO UPDATE SET
  items = EXCLUDED.items,
  updated_at = NOW();

-- Drawer / Side Menu
INSERT INTO nav_menus (tenant_id, menu_type, items)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'drawer',
  '[
    {"icon": "home",    "label": "à¸«à¸™à¹‰à¸²à¹à¸£à¸",             "link": "/",            "visible": true},
    {"icon": "scan",    "label": "à¸ªà¹à¸à¸™ QR Code",       "link": "/scan",        "visible": true},
    {"icon": "gift",    "label": "à¹à¸¥à¸à¸‚à¸­à¸‡à¸£à¸²à¸‡à¸§à¸±à¸¥",        "link": "/rewards",     "visible": true},
    {"icon": "star",    "label": "à¸à¸£à¸°à¹€à¸›à¹‹à¸²à¹€à¸‡à¸´à¸™",         "link": "/wallet",      "visible": true, "badge_type": "balance"},
    {"icon": "history", "label": "à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸ªà¹à¸à¸™",         "link": "/history",     "visible": true},
    {"icon": "trophy",  "label": "à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹à¸¥à¸à¸£à¸²à¸‡à¸§à¸±à¸¥",    "link": "/history/redeems", "visible": true},
    {"icon": "news",    "label": "à¸‚à¹ˆà¸²à¸§à¸ªà¸²à¸£",             "link": "/news",        "visible": true},
    {"icon": "user",    "label": "à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡à¸‰à¸±à¸™",       "link": "/profile",     "visible": true},
    {"icon": "heart",   "label": "à¸šà¸£à¸´à¸ˆà¸²à¸„à¹à¸•à¹‰à¸¡",          "link": "/donations",   "visible": false}
  ]'::jsonb
) ON CONFLICT (tenant_id, menu_type) DO UPDATE SET
  items = EXCLUDED.items,
  updated_at = NOW();

-- Header Menu
INSERT INTO nav_menus (tenant_id, menu_type, items)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'header',
  '[
    {"icon": "scan",    "label": "à¸ªà¹à¸à¸™",     "link": "/scan",    "visible": true},
    {"icon": "gift",    "label": "à¸£à¸²à¸‡à¸§à¸±à¸¥",   "link": "/rewards", "visible": true}
  ]'::jsonb
) ON CONFLICT (tenant_id, menu_type) DO UPDATE SET
  items = EXCLUDED.items,
  updated_at = NOW();


SELECT 'CMS mock data inserted successfully!' AS result;

