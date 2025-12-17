-- Migration: Add regions support for multi-national expansion
-- Created: 2025-10-09
-- Description: Adds regions table and updates campuses to support regional organization

-- Create regions table
CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,  -- e.g., 'AU', 'US', 'BR', 'ID'
    display_name TEXT NOT NULL,  -- e.g., 'Australia', 'United States'
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    active BOOLEAN DEFAULT 1,
    coming_soon BOOLEAN DEFAULT 0,  -- For regions not yet launched
    launch_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default regions
INSERT INTO regions (name, code, display_name, timezone, currency, active, coming_soon) VALUES
('australia', 'AU', 'Australia', 'Australia/Adelaide', 'AUD', 1, 0),
('united_states', 'US', 'United States', 'America/Los_Angeles', 'USD', 0, 1),
('brazil', 'BR', 'Brazil', 'America/Sao_Paulo', 'BRL', 0, 1),
('indonesia', 'ID', 'Indonesia', 'Asia/Jakarta', 'IDR', 0, 1);

-- Drop old table if migrating
-- DROP TABLE IF EXISTS campuses_new;

-- Create new campuses table with region support
CREATE TABLE IF NOT EXISTS campuses_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id TEXT NOT NULL UNIQUE,  -- e.g., 'adelaide_city', 'paradise'
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    region_id INTEGER NOT NULL,
    pastor_name TEXT,
    pastor_email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    latitude REAL,
    longitude REAL,
    active BOOLEAN DEFAULT 1,
    service_times TEXT,  -- JSON array of service times
    detection_patterns TEXT,  -- JSON array of detection patterns
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE RESTRICT
);

-- Migrate existing campus data from campuses.json to new table
-- This will be done via Python script since we need to read from campuses.json

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campuses_region ON campuses_new(region_id);
CREATE INDEX IF NOT EXISTS idx_campuses_active ON campuses_new(active);
CREATE INDEX IF NOT EXISTS idx_campuses_campus_id ON campuses_new(campus_id);
CREATE INDEX IF NOT EXISTS idx_regions_code ON regions(code);
CREATE INDEX IF NOT EXISTS idx_regions_active ON regions(active);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_campuses_timestamp 
AFTER UPDATE ON campuses_new
BEGIN
    UPDATE campuses_new SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_regions_timestamp 
AFTER UPDATE ON regions
BEGIN
    UPDATE regions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

