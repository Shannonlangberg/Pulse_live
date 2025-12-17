-- Fix Shannon's campus from all_campuses to copper_coast
-- This addresses the issue where prayer submissions show "All Campuses" instead of "Copper Coast"

UPDATE persons 
SET campus = 'copper_coast', 
    updated_at = CURRENT_TIMESTAMP 
WHERE email = 'shannonlangberg@gmail.com' 
  AND (campus = 'all_campuses' OR campus = 'paradise' OR campus != 'copper_coast');

-- Verify the change
SELECT email, campus, updated_at 
FROM persons 
WHERE email = 'shannonlangberg@gmail.com';


