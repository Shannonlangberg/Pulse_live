-- Migration: Add group chat functionality
-- Created: 2025-11-20
-- Description: Adds group chat messages table for connect groups

CREATE TABLE IF NOT EXISTS connect_group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES connect_groups(id),
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group ON connect_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created ON connect_group_messages(created_at);

