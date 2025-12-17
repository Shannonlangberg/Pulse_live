-- Update Shannon Langberg's campus to copper_coast
-- This fixes the issue where prayer requests were showing Paradise instead of Copper Coast

UPDATE persons 
SET campus = 'copper_coast', 
    updated_at = CURRENT_TIMESTAMP 
WHERE email = 'shannonlangberg@gmail.com' 
  AND campus != 'copper_coast';

-- Also update any other users that might have wrong campus
-- You can add more specific updates here if needed

