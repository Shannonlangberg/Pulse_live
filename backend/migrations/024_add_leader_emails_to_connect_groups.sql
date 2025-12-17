-- Add leader_emails column to connect_groups table
-- This allows multiple leaders to access the connect group portal

ALTER TABLE connect_groups ADD COLUMN leader_emails TEXT;





