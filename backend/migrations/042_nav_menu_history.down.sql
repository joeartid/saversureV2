DROP INDEX IF EXISTS idx_nav_menu_history_lookup;
DROP TABLE IF EXISTS nav_menu_history;
ALTER TABLE nav_menus DROP COLUMN IF EXISTS version;
