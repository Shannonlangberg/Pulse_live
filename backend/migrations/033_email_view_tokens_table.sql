-- Migration: Create email_view_tokens table for secure email viewing
-- Created: 2024-11-24

CREATE TABLE IF NOT EXISTS email_view_tokens (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL,
    recipient_id VARCHAR(36) NOT NULL,
    person_id VARCHAR(36),
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    viewed_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES campaign_recipients(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_view_tokens_token ON email_view_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_view_tokens_campaign_id ON email_view_tokens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_view_tokens_recipient_id ON email_view_tokens(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_view_tokens_person_id ON email_view_tokens(person_id);
CREATE INDEX IF NOT EXISTS idx_email_view_tokens_expires_at ON email_view_tokens(expires_at);

