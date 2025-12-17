-- Migration: Add missing columns to resource_categories table
-- Created: 2025-11-19
-- Description: Adds links and is_active columns that are required by the model

-- Add links column if it doesn't exist
ALTER TABLE resource_categories ADD COLUMN links TEXT DEFAULT '[]';

-- Add is_active column if it doesn't exist
ALTER TABLE resource_categories ADD COLUMN is_active BOOLEAN DEFAULT 1;

-- Update existing rows to have default values
UPDATE resource_categories SET links = '[]' WHERE links IS NULL;
UPDATE resource_categories SET is_active = 1 WHERE is_active IS NULL;






