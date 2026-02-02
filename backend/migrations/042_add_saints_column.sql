-- Migration: Add saints column to attendance_records table
-- Date: 2026-02-02
-- Description: Add saints field to track senior/elderly ministry attendance

-- Add saints column with default value of 0
ALTER TABLE attendance_records ADD COLUMN saints INTEGER DEFAULT 0;

-- Update existing records to set saints to 0 if NULL
UPDATE attendance_records SET saints = 0 WHERE saints IS NULL;

