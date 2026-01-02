-- Create finance_records table for storing tithe/finance data
-- This ensures finance data is stored in database AND Google Sheets

CREATE TABLE IF NOT EXISTS finance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    campus_id VARCHAR(100) NOT NULL,
    campus_name VARCHAR(200) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'AU',
    
    -- Tithe breakdown
    general DECIMAL(10, 2) DEFAULT 0,
    trust DECIMAL(10, 2) DEFAULT 0,
    online DECIMAL(10, 2) DEFAULT 0,
    text DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) DEFAULT 0,
    
    -- Metadata
    synced_to_sheets BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(200),
    updated_by VARCHAR(200),
    
    -- Ensure one record per campus per date
    UNIQUE(date, campus_id, region)
);

