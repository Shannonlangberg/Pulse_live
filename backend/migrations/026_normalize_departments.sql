-- Migration: Normalize department values to standard case format
-- Created: 2025-01-XX
-- Description: Standardize department case (Kids, Youth, Young Adults, Families, Adults, Seniors)
-- This ensures the department filter works correctly regardless of how data was imported

-- Normalize department values to standard format
UPDATE persons 
SET department = 'Kids'
WHERE LOWER(department) = 'kids' AND department != 'Kids';

UPDATE persons 
SET department = 'Youth'
WHERE LOWER(department) = 'youth' AND department != 'Youth';

UPDATE persons 
SET department = 'Young Adults'
WHERE LOWER(department) IN ('young adults', 'youngadults', 'young_adults') 
  AND department != 'Young Adults';

UPDATE persons 
SET department = 'Families'
WHERE LOWER(department) = 'families' AND department != 'Families';

UPDATE persons 
SET department = 'Adults'
WHERE LOWER(department) = 'adults' AND department != 'Adults';

UPDATE persons 
SET department = 'Seniors'
WHERE LOWER(department) = 'seniors' AND department != 'Seniors';

-- For any other department values, normalize to Title Case
UPDATE persons
SET department = (
    CASE 
        WHEN SUBSTR(department, 1, 1) <> UPPER(SUBSTR(department, 1, 1)) OR
             department LIKE '% %' AND department NOT LIKE 'Young Adults'
        THEN (
            -- Title case each word
            CASE 
                WHEN LENGTH(department) > 0 THEN
                    -- Simple title case: first letter uppercase, rest lowercase
                    UPPER(SUBSTR(department, 1, 1)) || 
                    LOWER(SUBSTR(department, 2))
                ELSE department
            END
        )
        ELSE department
    END
)
WHERE department IS NOT NULL 
  AND department NOT IN ('Kids', 'Youth', 'Young Adults', 'Families', 'Adults', 'Seniors')
  AND department NOT LIKE '% %';  -- Skip multi-word that aren't "Young Adults"

