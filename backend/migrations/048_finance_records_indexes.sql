-- Add indexes to finance_records table for faster queries

CREATE INDEX IF NOT EXISTS idx_finance_records_date ON finance_records(date);
CREATE INDEX IF NOT EXISTS idx_finance_records_campus ON finance_records(campus_id);
CREATE INDEX IF NOT EXISTS idx_finance_records_region ON finance_records(region);
CREATE INDEX IF NOT EXISTS idx_finance_records_date_campus ON finance_records(date, campus_id);


