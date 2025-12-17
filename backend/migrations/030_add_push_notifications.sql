-- Migration: Add push notifications system
-- Created: 2025-01-21
-- Description: Adds push notification tokens and scheduled notifications tables

CREATE TABLE IF NOT EXISTS push_notification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    email TEXT NOT NULL,
    expo_push_token TEXT NOT NULL UNIQUE,
    platform TEXT,
    device_id TEXT,
    app_version TEXT,
    is_active BOOLEAN DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_email ON push_notification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_notification_tokens(expo_push_token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_notification_tokens(is_active);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    target_audience TEXT DEFAULT 'all',
    target_campus TEXT,
    target_emails TEXT,
    target_role TEXT,
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status TEXT DEFAULT 'pending',
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);

