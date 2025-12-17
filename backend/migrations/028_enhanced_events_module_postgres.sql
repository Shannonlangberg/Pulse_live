-- Migration: Enhanced Events Module - PCO-level functionality (PostgreSQL version)
-- Created: 2025-01-XX
-- Description: Adds comprehensive event management features including registrations, teams, resources, recurrence, status, visibility
-- NOTE: This is the PostgreSQL version. For SQLite, use 028_enhanced_events_module.sql

-- Add new columns to events table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='ministry') THEN
        ALTER TABLE events ADD COLUMN ministry TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='is_all_day') THEN
        ALTER TABLE events ADD COLUMN is_all_day BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='recurrence_rule') THEN
        ALTER TABLE events ADD COLUMN recurrence_rule TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='status') THEN
        ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='visibility') THEN
        ALTER TABLE events ADD COLUMN visibility TEXT DEFAULT 'public';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='capacity') THEN
        ALTER TABLE events ADD COLUMN capacity INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='registration_required') THEN
        ALTER TABLE events ADD COLUMN registration_required BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='registration_form_id') THEN
        ALTER TABLE events ADD COLUMN registration_form_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='tags') THEN
        ALTER TABLE events ADD COLUMN tags TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='created_by_user_id') THEN
        ALTER TABLE events ADD COLUMN created_by_user_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='updated_by_user_id') THEN
        ALTER TABLE events ADD COLUMN updated_by_user_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='location_id') THEN
        ALTER TABLE events ADD COLUMN location_id INTEGER;
    END IF;
END $$;

-- Update existing events to have default values
UPDATE events SET status = 'published' WHERE status IS NULL AND is_active = TRUE;
UPDATE events SET status = 'draft' WHERE status IS NULL AND is_active = FALSE;
UPDATE events SET visibility = 'public' WHERE visibility IS NULL;
UPDATE events SET is_all_day = FALSE WHERE is_all_day IS NULL;
UPDATE events SET registration_required = FALSE WHERE registration_required IS NULL;

-- Create event_registrations table
CREATE TABLE IF NOT EXISTS event_registrations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    email TEXT,
    name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'registered',
    guest_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create event_team_assignments table
CREATE TABLE IF NOT EXISTS event_team_assignments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create event_resource_bookings table
CREATE TABLE IF NOT EXISTS event_resource_bookings (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'requested',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

