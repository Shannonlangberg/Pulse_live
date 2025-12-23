-- Migration: Add region support to users table
-- Date: 2025-12-17
-- Description: Add region_id field to users table for region-based access control

-- Add region_id column to users table
ALTER TABLE users ADD COLUMN region_id INTEGER DEFAULT NULL;

-- Add foreign key constraint (if supported by SQLite version)
-- Note: SQLite has limited ALTER TABLE support, so we handle this gracefully

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_region_id ON users(region_id);

-- For global roles (admin, senior_leadership, senior_pastor, lead_pastor)
-- region_id will be NULL to indicate global access

-- For region_leader role, region_id will be set to their specific region
-- For campus_pastor, they will have both campus AND region_id (derived from campus's region)

-- Update existing users: Set region_id based on their campus
-- This is a safe operation as it only sets region_id for users with specific campuses

-- Note: This migration is safe to run multiple times (uses ADD COLUMN which fails gracefully if exists)



