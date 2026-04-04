-- Allow point_cost = 0 for free rewards or diamond-only rewards (migrated from V1)
ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_point_cost_check;
ALTER TABLE rewards ADD CONSTRAINT rewards_point_cost_check CHECK (point_cost >= 0);
