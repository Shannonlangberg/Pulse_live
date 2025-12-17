-- Migration: Add step_actions to pathway steps
-- Created: 2025-01-XX
-- Description: Add step_actions field to store tasks/actions for each journey step (e.g., watch videos, read content, etc.)

-- Add step_actions column to discipleship_pathway_steps table
-- This will store JSON array of actions like:
-- [{"type": "watch_video", "title": "Watch This is Christianity on Pulse", "url": "https://...", "icon": "play"}, ...]
ALTER TABLE discipleship_pathway_steps 
ADD COLUMN step_actions TEXT DEFAULT '[]';

-- Update any existing steps to have empty actions array
UPDATE discipleship_pathway_steps 
SET step_actions = '[]' 
WHERE step_actions IS NULL;

