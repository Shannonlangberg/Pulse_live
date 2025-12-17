-- Migration: Add department column to persons table
-- Created: 2025-11-17
-- Description: Add department field to persons table for categorizing people (Kids, Youth, Young Adults, Families, Adults, Seniors)

-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll handle this in Python by catching the error if column already exists
-- This migration will be skipped if the column already exists (handled in run_migrations)

-- Try to add the column (will fail silently if it already exists, handled by Python)
ALTER TABLE persons ADD COLUMN department TEXT;

-- Create index for department filtering (IF NOT EXISTS is supported for indexes)
CREATE INDEX IF NOT EXISTS idx_persons_department ON persons(department);

