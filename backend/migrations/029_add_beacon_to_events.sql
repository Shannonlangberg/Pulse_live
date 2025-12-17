-- Migration: Add beacon_zone_id to events table for automatic attendance tracking
-- Date: 2025-01-21
-- Description: Links events to beacon zones for automatic attendance tracking via Bluetooth beacons

-- Add beacon_zone_id column to events table
ALTER TABLE events ADD COLUMN beacon_zone_id INTEGER;

-- Add foreign key constraint (if beacon_zones table exists)
-- Note: SQLite doesn't support ADD CONSTRAINT, so this is for PostgreSQL
-- For SQLite, the foreign key relationship is handled at the application level

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_events_beacon_zone_id ON events(beacon_zone_id);

