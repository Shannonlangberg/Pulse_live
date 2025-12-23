-- Migration: Activate Brazil and Indonesia regions
-- Date: 2025-12-17
-- Description: Set Brazil and Indonesia regions as active

-- Activate Brazil
UPDATE regions 
SET active = 1, coming_soon = 0 
WHERE code = 'BR';

-- Activate Indonesia
UPDATE regions 
SET active = 1, coming_soon = 0 
WHERE code = 'ID';

-- Display active regions
SELECT id, code, display_name, active, coming_soon 
FROM regions 
ORDER BY id;



