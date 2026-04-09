-- Migration: Persist Google OAuth refresh token per user
-- Date: 2026-04-07
-- Description: After authorizing Drive once, users stay connected across logins
--              until they revoke access in Google. App auto-refreshes access tokens.

ALTER TABLE users ADD COLUMN google_refresh_token TEXT DEFAULT NULL;
