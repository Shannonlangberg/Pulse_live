-- Migration: Add email_lists table for custom email list management
-- Created: 2025-01-XX
-- Description: Support for custom email lists (e.g., "Business People", "New People")

CREATE TABLE IF NOT EXISTS email_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    list_type TEXT NOT NULL DEFAULT 'custom',
    filter_criteria TEXT,  -- JSON
    members TEXT NOT NULL DEFAULT '[]',  -- JSON array
    member_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_lists_created_by ON email_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_email_lists_list_type ON email_lists(list_type);
CREATE INDEX IF NOT EXISTS idx_email_lists_created_at ON email_lists(created_at);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_email_lists_timestamp 
AFTER UPDATE ON email_lists
BEGIN
    UPDATE email_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;


