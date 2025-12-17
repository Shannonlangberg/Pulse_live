-- Migration: Add giving subscriptions table for recurring payments
-- Created: 2025-01-XX
-- Description: Support recurring giving via Stripe Subscriptions

CREATE TABLE IF NOT EXISTS giving_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'AUD',
    giving_type TEXT NOT NULL,
    campus TEXT NOT NULL,
    source TEXT NOT NULL,
    qr_code_id TEXT,
    interval TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT 0,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_giving_subscriptions_person ON giving_subscriptions(person_id);
CREATE INDEX IF NOT EXISTS idx_giving_subscriptions_stripe_sub ON giving_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_giving_subscriptions_stripe_customer ON giving_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_giving_subscriptions_status ON giving_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_giving_subscriptions_campus ON giving_subscriptions(campus);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_giving_subscriptions_timestamp 
AFTER UPDATE ON giving_subscriptions
BEGIN
    UPDATE giving_subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

