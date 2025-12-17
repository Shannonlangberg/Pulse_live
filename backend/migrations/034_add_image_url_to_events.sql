-- Migration: Add image_url to events table
-- Created: 2025-11-24
-- Description: Adds image_url column to events table for event thumbnail images uploaded via Events Manager

-- Add image_url column to events table
ALTER TABLE events ADD COLUMN image_url TEXT;

