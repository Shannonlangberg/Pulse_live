-- Migration: Force user reseed
-- Created: 2025-10-15
-- Description: Delete all users to force a fresh seed with correct usernames

-- Delete all users to trigger re-seeding
DELETE FROM users;

-- The seed_users.py script will run after this and populate with correct data

