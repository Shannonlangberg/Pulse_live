-- Migration: Add new person tracking fields and ensure all people section fields exist
-- This migration safely adds columns that may be missing
-- Date: 2024-12-XX

-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- The migration runner should check for column existence first
-- If columns already exist, this will fail - that's expected and should be handled gracefully

-- Ensure is_new_christian exists (from migration 035, but may not have been run)
-- Using INTEGER for SQLite boolean (0 = false, 1 = true)
ALTER TABLE persons ADD COLUMN is_new_christian INTEGER DEFAULT 0;

-- Ensure new_christian_date exists (from migration 035)
ALTER TABLE persons ADD COLUMN new_christian_date DATE;

-- Ensure follow_up_status exists (from migration 035)
ALTER TABLE persons ADD COLUMN follow_up_status TEXT;

-- Ensure service_attended exists (from migration 035)
ALTER TABLE persons ADD COLUMN service_attended TEXT;

-- Ensure family_id exists (from migration 035)
ALTER TABLE persons ADD COLUMN family_id TEXT;

-- Add new person tracking fields
ALTER TABLE persons ADD COLUMN is_new_person INTEGER DEFAULT 0;
ALTER TABLE persons ADD COLUMN new_person_date DATE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_persons_is_new_person ON persons(is_new_person);
CREATE INDEX IF NOT EXISTS idx_persons_new_person_date ON persons(new_person_date);
CREATE INDEX IF NOT EXISTS idx_persons_is_new_christian ON persons(is_new_christian);
CREATE INDEX IF NOT EXISTS idx_persons_new_christian_date ON persons(new_christian_date);
CREATE INDEX IF NOT EXISTS idx_persons_family_id ON persons(family_id);
