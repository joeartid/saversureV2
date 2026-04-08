-- Seed default "home" page_config using Phase 3 sections
-- Pattern: same as Phase 1 (profile) / Phase 2 (history)
-- Safe: uses ON CONFLICT DO NOTHING so existing configs are never overwritten
-- Idempotent: can be re-run safely
--
-- Sections order (matches visual order of old hard-coded Jula's Herb home):
--   1. points_summary           — greeting + balance card (keeps "สวัสดี <name>")
--   2. home_news_banner_carousel — news banners from /api/v1/public/news
--   3. home_section_heading     — "แลกสิทธิพิเศษสำหรับคุณ"
--   4. home_rewards_tabs        — rewards + lucky-draw tabs (NO donate)
--
-- Seeds for EVERY existing tenant that does not yet have a 'home' page_config.

BEGIN;

INSERT INTO page_configs (tenant_id, page_slug, sections, status, version)
SELECT
    t.id,
    'home',
    '[
      {
        "id": "points-summary-default",
        "type": "points_summary",
        "order": 1,
        "visible": true,
        "props": { "show_greeting": true }
      },
      {
        "id": "home-news-banner-default",
        "type": "home_news_banner_carousel",
        "order": 2,
        "visible": true,
        "props": {
          "limit": 5,
          "auto_play": true,
          "interval_ms": 3000,
          "show_dots": true
        }
      },
      {
        "id": "home-section-heading-default",
        "type": "home_section_heading",
        "order": 3,
        "visible": true,
        "props": {
          "title": "แลกสิทธิพิเศษสำหรับคุณ",
          "subtitle": "",
          "align": "left"
        }
      },
      {
        "id": "home-rewards-tabs-default",
        "type": "home_rewards_tabs",
        "order": 4,
        "visible": true,
        "props": {
          "limit": 20,
          "default_tab": "julaherb",
          "show_flash_badge": true,
          "tabs": [
            { "key": "julaherb",  "label": "สินค้าจุฬาเฮิร์บ", "source": "rewards-product"  },
            { "key": "premium",   "label": "สินค้าพรีเมียม",   "source": "rewards-premium"  },
            { "key": "lifestyle", "label": "ไลฟ์สไตล์",         "source": "rewards-lifestyle"},
            { "key": "lucky",     "label": "ลุ้นโชค",           "source": "lucky-draw"       }
          ]
        }
      }
    ]'::jsonb,
    'published',
    1
FROM tenants t
ON CONFLICT (tenant_id, page_slug) DO NOTHING;

COMMIT;

-- Rollback note: to reset a specific tenant back to fallback, run:
--   DELETE FROM page_configs WHERE page_slug='home' AND tenant_id='<tenant-uuid>';
-- Consumer /page.tsx will then render <HomeFallback /> (old hard-coded layout).
