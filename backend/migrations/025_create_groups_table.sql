-- Migration: Create groups table for regular groups (separate from connect groups)
-- Date: 2024-11-20

CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    campus VARCHAR(100) NOT NULL DEFAULT 'all_campuses',
    leader_id VARCHAR(50),
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leader_id) REFERENCES persons(id)
);

CREATE INDEX IF NOT EXISTS idx_groups_campus ON groups(campus);
CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id);
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);











