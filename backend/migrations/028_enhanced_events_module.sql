-- Migration: Enhanced Events Module - PCO-level functionality
-- Created: 2025-01-XX
-- Description: Adds comprehensive event management features including registrations, teams, resources, recurrence, status, visibility

-- Add new columns to events table
-- Note: SQLite doesn't support IF NOT EXISTS in ALTER TABLE
-- The migration runner will catch "duplicate column" errors and continue
-- This is safe to run multiple times - existing columns will be skipped

-- Try to add each column (will fail if column already exists, but migration runner handles it)
-- Execute these one at a time so failures don't stop the whole migration
ALTER TABLE events ADD COLUMN ministry TEXT;
ALTER TABLE events ADD COLUMN is_all_day BOOLEAN DEFAULT 0;
ALTER TABLE events ADD COLUMN recurrence_rule TEXT;
ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'draft';
ALTER TABLE events ADD COLUMN visibility TEXT DEFAULT 'public';
ALTER TABLE events ADD COLUMN capacity INTEGER;
ALTER TABLE events ADD COLUMN registration_required BOOLEAN DEFAULT 0;
ALTER TABLE events ADD COLUMN registration_form_id INTEGER;
ALTER TABLE events ADD COLUMN tags TEXT;
ALTER TABLE events ADD COLUMN created_by_user_id INTEGER;
ALTER TABLE events ADD COLUMN updated_by_user_id INTEGER;
ALTER TABLE events ADD COLUMN location_id INTEGER;

-- Update existing events to have default values
UPDATE events SET status = 'published' WHERE status IS NULL AND is_active = 1;
UPDATE events SET status = 'draft' WHERE status IS NULL AND is_active = 0;
UPDATE events SET visibility = 'public' WHERE visibility IS NULL;
UPDATE events SET is_all_day = 0 WHERE is_all_day IS NULL;
UPDATE events SET registration_required = 0 WHERE registration_required IS NULL;

-- Create event_registrations table
CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    person_id TEXT,
    email TEXT,
    name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'registered',
    guest_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE SET NULL
);

-- Create event_team_assignments table
CREATE TABLE IF NOT EXISTS event_team_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    person_id TEXT NOT NULL,
    role TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
);

-- Create event_resource_bookings table
CREATE TABLE IF NOT EXISTS event_resource_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    resource_type TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    status TEXT DEFAULT 'requested',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_person_id ON event_registrations(person_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(status);
CREATE INDEX IF NOT EXISTS idx_event_team_assignments_event_id ON event_team_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_team_assignments_person_id ON event_team_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_event_resource_bookings_event_id ON event_resource_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_event_resource_bookings_status ON event_resource_bookings(status);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_campus ON events(campus);

