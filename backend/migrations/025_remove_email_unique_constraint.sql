-- Migration: Remove unique constraint from email column in persons table
-- Created: 2025-01-XX
-- Description: Allow multiple people to share the same email address (e.g., family members, kids)

-- In SQLite, column-level UNIQUE constraints are part of the table definition
-- We need to recreate the table without the unique constraint

-- Step 1: Create a temporary table with the same structure but without unique constraint on email
CREATE TABLE IF NOT EXISTS persons_new (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    preferred_name TEXT,
    email TEXT,  -- Removed UNIQUE constraint
    phone TEXT,
    campus TEXT NOT NULL,
    department TEXT,
    connect_group TEXT,
    dream_team_roles TEXT,
    birthday DATE,
    pastoral_notes TEXT,
    tags TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dna_completed DATE,
    baptised_on DATE,
    filled_holy_spirit DATE,
    rise_attended DATE,
    first_served_on DATE
);

-- Step 2: Copy all data from old table to new table
INSERT INTO persons_new 
SELECT 
    id,
    full_name,
    preferred_name,
    email,
    phone,
    campus,
    department,
    connect_group,
    dream_team_roles,
    birthday,
    pastoral_notes,
    tags,
    is_active,
    created_at,
    updated_at,
    dna_completed,
    baptised_on,
    filled_holy_spirit,
    rise_attended,
    first_served_on
FROM persons;

-- Step 3: Drop the old table
DROP TABLE IF EXISTS persons;

-- Step 4: Rename the new table to the original name
ALTER TABLE persons_new RENAME TO persons;

-- Step 5: Recreate indexes if they existed
CREATE INDEX IF NOT EXISTS idx_persons_campus ON persons(campus);
CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);  -- Non-unique index for searching
CREATE INDEX IF NOT EXISTS idx_persons_is_active ON persons(is_active);
CREATE INDEX IF NOT EXISTS idx_persons_department ON persons(department);

-- Note: Foreign key constraints from other tables (like engagement_profiles) will still work
-- because the primary key (id) remains the same

