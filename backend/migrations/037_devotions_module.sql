-- Migration: Devotions Module
-- Created: 2025-01-12
-- Description: Create devotions tables for persistent storage

-- Devotion Plans table
CREATE TABLE IF NOT EXISTS devotion_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    source TEXT DEFAULT 'canvas',
    campus TEXT,
    audience TEXT,  -- JSON stored as text
    status TEXT DEFAULT 'draft',
    is_assigned INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    total_days INTEGER DEFAULT 30,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devotion Content table (individual days)
CREATE TABLE IF NOT EXISTS devotion_content (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    day_index INTEGER NOT NULL,
    scripture_ref TEXT,
    scripture_text TEXT,
    devo_body TEXT,
    title TEXT,
    prayer_focus TEXT,
    media TEXT,  -- JSON stored as text
    cover_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES devotion_plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, day_index)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_devotion_plans_status ON devotion_plans(status);
CREATE INDEX IF NOT EXISTS idx_devotion_plans_campus ON devotion_plans(campus);
CREATE INDEX IF NOT EXISTS idx_devotion_plans_created_at ON devotion_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_devotion_content_plan_id ON devotion_content(plan_id);
CREATE INDEX IF NOT EXISTS idx_devotion_content_day_index ON devotion_content(day_index);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_devotion_plans_timestamp 
AFTER UPDATE ON devotion_plans
BEGIN
    UPDATE devotion_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_devotion_content_timestamp 
AFTER UPDATE ON devotion_content
BEGIN
    UPDATE devotion_content SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

