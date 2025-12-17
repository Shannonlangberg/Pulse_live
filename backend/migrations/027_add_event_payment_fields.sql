-- Migration: Add payment fields to events table
-- Created: 2025-11-20
-- Description: Adds price, requires_payment, and stripe_price_id columns to events table for paid events

-- Add payment columns to events table
ALTER TABLE events ADD COLUMN price NUMERIC(10, 2);
ALTER TABLE events ADD COLUMN requires_payment BOOLEAN DEFAULT 0;
ALTER TABLE events ADD COLUMN stripe_price_id TEXT;

-- Update existing events to have requires_payment = 0 (False)
UPDATE events SET requires_payment = 0 WHERE requires_payment IS NULL;

