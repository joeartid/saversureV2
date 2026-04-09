-- One-off fix: raise home_rewards_tabs limit from 20 to 100
-- Reason: ?limit=20 over-fetches mixed types, client-side filter drops products.
-- 16 products visible but only 13 were showing in home "สินค้าจุฬาเฮิร์บ" tab.
-- Backend caps limit at 100 (backend/internal/reward/service.go:106).
-- Total visible rewards = 83, so limit=100 covers every tab completely.

UPDATE page_configs
SET sections = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'type' = 'home_rewards_tabs'
        THEN jsonb_set(elem, '{props,limit}', '100'::jsonb)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(sections) AS elem
),
updated_at = NOW(),
version = version + 1
WHERE page_slug = 'home';
