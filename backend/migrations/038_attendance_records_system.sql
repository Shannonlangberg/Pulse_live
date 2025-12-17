-- Migration: Attendance Records System - Replace Google Sheets
-- Date: 2025-12-17
-- Description: Create comprehensive attendance tracking system with multi-region support

-- Step 1: Create regions table
CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    active BOOLEAN DEFAULT 1,
    coming_soon BOOLEAN DEFAULT 0,
    launch_date DATE,
    sheets_spreadsheet_id TEXT,
    sheets_stats_tab TEXT DEFAULT 'Stats',
    sheets_finance_tab TEXT DEFAULT 'Tithe',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Insert default regions
INSERT OR IGNORE INTO regions (name, code, display_name, timezone, currency, active, coming_soon) VALUES
('australia', 'AU', 'Australia', 'Australia/Adelaide', 'AUD', 1, 0);

INSERT OR IGNORE INTO regions (name, code, display_name, timezone, currency, active, coming_soon) VALUES
('united_states', 'US', 'United States', 'America/Los_Angeles', 'USD', 0, 1);

INSERT OR IGNORE INTO regions (name, code, display_name, timezone, currency, active, coming_soon) VALUES
('brazil', 'BR', 'Brazil', 'America/Sao_Paulo', 'BRL', 0, 1);

INSERT OR IGNORE INTO regions (name, code, display_name, timezone, currency, active, coming_soon) VALUES
('indonesia', 'ID', 'Indonesia', 'Asia/Jakarta', 'IDR', 0, 1);

-- Step 3: Create campuses_v2 table
CREATE TABLE IF NOT EXISTS campuses_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id TEXT NOT NULL UNIQUE,
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
    service_times TEXT,
    detection_patterns TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE RESTRICT
);

-- Step 4: Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_attendance INTEGER DEFAULT 0,
    total_people_in_campus INTEGER DEFAULT 0,
    adult_service_breakdown TEXT,
    kids_service_breakdown TEXT,
    kids_attendance INTEGER DEFAULT 0,
    kids_leaders INTEGER DEFAULT 0,
    new_kids INTEGER DEFAULT 0,
    new_kids_salvations INTEGER DEFAULT 0,
    packs_out INTEGER DEFAULT 0,
    youth_attendance INTEGER DEFAULT 0,
    youth_salvations INTEGER DEFAULT 0,
    youth_new_people INTEGER DEFAULT 0,
    youth_leaders INTEGER DEFAULT 0,
    first_time_visitors INTEGER DEFAULT 0,
    visitors INTEGER DEFAULT 0,
    hands_up INTEGER DEFAULT 0,
    cards_back INTEGER DEFAULT 0,
    first_time_christians INTEGER DEFAULT 0,
    rededications INTEGER DEFAULT 0,
    salvation_cards_returned INTEGER DEFAULT 0,
    baptisms INTEGER DEFAULT 0,
    child_dedications INTEGER DEFAULT 0,
    connect_groups INTEGER DEFAULT 0,
    dream_team INTEGER DEFAULT 0,
    tithe DECIMAL(10, 2) DEFAULT 0,
    created_by INTEGER,
    synced_to_sheets BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campus_id) REFERENCES campuses_v2(id) ON DELETE CASCADE,
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE RESTRICT,
    UNIQUE(campus_id, date)
);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_campus_date ON attendance_records(campus_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_region_date ON attendance_records(region_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

CREATE INDEX IF NOT EXISTS idx_attendance_region ON attendance_records(region_id);

CREATE INDEX IF NOT EXISTS idx_attendance_campus ON attendance_records(campus_id);

CREATE INDEX IF NOT EXISTS idx_campuses_region ON campuses_v2(region_id);

CREATE INDEX IF NOT EXISTS idx_campuses_active ON campuses_v2(active);

CREATE INDEX IF NOT EXISTS idx_campuses_campus_id ON campuses_v2(campus_id);

CREATE INDEX IF NOT EXISTS idx_regions_code ON regions(code);

CREATE INDEX IF NOT EXISTS idx_regions_active ON regions(active);

