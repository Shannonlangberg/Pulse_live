-- Migration: Create prayer_links table for Prayer & Praise submission links
-- Similar to giving_qr_codes but for prayer/praise tap points, QR codes, and social media links

CREATE TABLE IF NOT EXISTS prayer_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT UNIQUE NOT NULL,
    link_type TEXT NOT NULL DEFAULT 'both',  -- 'prayer', 'praise', 'both'
    campus TEXT,  -- Optional campus filter
    department TEXT,  -- Optional department filter (Kids, Youth, Adults, etc.)
    location TEXT,  -- e.g., "Main Entrance", "Youth Room", "Social Media"
    description TEXT,  -- Admin notes
    code_type TEXT DEFAULT 'qr',  -- 'qr', 'nfc', 'link'
    is_active INTEGER DEFAULT 1,
    scan_count INTEGER DEFAULT 0,
    submission_count INTEGER DEFAULT 0,
    last_scan_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prayer_links_link_id ON prayer_links(link_id);
CREATE INDEX IF NOT EXISTS idx_prayer_links_campus ON prayer_links(campus);
CREATE INDEX IF NOT EXISTS idx_prayer_links_active ON prayer_links(is_active);
CREATE INDEX IF NOT EXISTS idx_prayer_links_type ON prayer_links(link_type);

