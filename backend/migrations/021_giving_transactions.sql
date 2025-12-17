-- Migration: Giving Transactions and QR Codes
-- Adds detailed transaction tracking and QR code system for tap-to-give

-- Giving Transactions Table
CREATE TABLE IF NOT EXISTS giving_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    stripe_payment_intent_id VARCHAR(200) UNIQUE,
    amount REAL NOT NULL,
    currency VARCHAR(10) DEFAULT 'AUD',
    giving_type VARCHAR(50) NOT NULL,
    campus VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,  -- 'app', 'qr_code', 'web', 'tap_to_give', 'manual'
    qr_code_id VARCHAR(100),
    service_date DATE,
    status VARCHAR(50) DEFAULT 'completed',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

CREATE INDEX IF NOT EXISTS idx_giving_transactions_person ON giving_transactions(person_id);
CREATE INDEX IF NOT EXISTS idx_giving_transactions_campus ON giving_transactions(campus);
CREATE INDEX IF NOT EXISTS idx_giving_transactions_date ON giving_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_giving_transactions_source ON giving_transactions(source);
CREATE INDEX IF NOT EXISTS idx_giving_transactions_service_date ON giving_transactions(service_date);
CREATE INDEX IF NOT EXISTS idx_giving_transactions_qr_code ON giving_transactions(qr_code_id);

-- Giving QR Codes Table
CREATE TABLE IF NOT EXISTS giving_qr_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_code_id VARCHAR(100) UNIQUE NOT NULL,
    campus VARCHAR(100) NOT NULL,
    zone VARCHAR(100),
    seat_number VARCHAR(50),
    is_active BOOLEAN DEFAULT 1,
    scan_count INTEGER DEFAULT 0,
    last_scan_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_giving_qr_codes_campus ON giving_qr_codes(campus);
CREATE INDEX IF NOT EXISTS idx_giving_qr_codes_active ON giving_qr_codes(is_active);


