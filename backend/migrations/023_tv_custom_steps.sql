-- Migration: Add custom step creation fields to TV Series and Episodes
-- Allows episodes/series to create custom discipleship steps with their titles

-- Add fields to TV Series
ALTER TABLE tv_series ADD COLUMN create_custom_step BOOLEAN DEFAULT 0;
ALTER TABLE tv_series ADD COLUMN custom_step_name VARCHAR(200);

-- Add fields to TV Episodes  
ALTER TABLE tv_episodes ADD COLUMN create_custom_step BOOLEAN DEFAULT 0;
ALTER TABLE tv_episodes ADD COLUMN custom_step_name VARCHAR(200);

