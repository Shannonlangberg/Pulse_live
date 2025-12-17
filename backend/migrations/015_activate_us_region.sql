-- Migration: Activate US Region
-- Created: 2025-10-15
-- Description: Activates United States region so admins can add US campuses through the UI

-- Activate United States region
UPDATE regions 
SET active = 1, coming_soon = 0 
WHERE code = 'US';

