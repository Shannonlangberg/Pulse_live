-- Migration: Add thumbnail_url to TVEpisode for individual episode thumbnails
-- Created: 2025-01-XX

-- Add thumbnail_url column to tv_episodes table
ALTER TABLE tv_episodes ADD COLUMN thumbnail_url VARCHAR(500);








