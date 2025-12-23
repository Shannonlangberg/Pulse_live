-- Migration 040: Homepage Messages
-- Create table for managing homepage messages that can be displayed on the landing page
-- Supports regional filtering and admin management

CREATE TABLE IF NOT EXISTS homepage_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    heading TEXT NOT NULL,
    message TEXT NOT NULL,
    region_code TEXT DEFAULT 'AU',
    is_active BOOLEAN DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (region_code) REFERENCES regions(code) ON DELETE CASCADE
);

-- Create index for faster queries by region and active status
CREATE INDEX IF NOT EXISTS idx_homepage_messages_region_active 
ON homepage_messages(region_code, is_active);

-- Create index for display order
CREATE INDEX IF NOT EXISTS idx_homepage_messages_order 
ON homepage_messages(display_order);



