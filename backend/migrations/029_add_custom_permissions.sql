-- Migration: Add custom_permissions column to users table
-- Created: 2025-01-XX
-- Description: Allow per-user custom permissions that override role-based defaults

-- Add custom_permissions column to store JSON permissions
ALTER TABLE users ADD COLUMN custom_permissions TEXT DEFAULT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_custom_permissions ON users(custom_permissions);

