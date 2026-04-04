-- Revert to strict point_cost > 0
ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_point_cost_check;
ALTER TABLE rewards ADD CONSTRAINT rewards_point_cost_check CHECK (point_cost > 0);
