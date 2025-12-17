-- Migration: Add beacon schedules for context-aware event detection
-- Created: 2025-01-XX
-- Description: Allows beacons to log different event types based on day/time

-- Beacon Schedules table
CREATE TABLE IF NOT EXISTS beacon_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beacon_zone_id INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- 'sunday', 'youth', 'prayer_night', 'kids', etc.
    day_of_week VARCHAR(20),  -- 'Sunday', 'Monday', 'Friday', etc. (NULL = any day)
    start_time TIME,  -- e.g., '19:00:00' for 7 PM
    end_time TIME,  -- e.g., '22:00:00' for 10 PM
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beacon_zone_id) REFERENCES beacon_zones(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beacon_schedules_zone ON beacon_schedules(beacon_zone_id);
CREATE INDEX IF NOT EXISTS idx_beacon_schedules_active ON beacon_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_beacon_schedules_day ON beacon_schedules(day_of_week);






