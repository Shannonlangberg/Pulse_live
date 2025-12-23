-- Add Google Sheets config columns to regions table for backward compatibility
ALTER TABLE regions ADD COLUMN sheets_spreadsheet_id VARCHAR(200);
ALTER TABLE regions ADD COLUMN sheets_stats_tab VARCHAR(100) DEFAULT 'Stats';
ALTER TABLE regions ADD COLUMN sheets_finance_tab VARCHAR(100) DEFAULT 'Tithe';

