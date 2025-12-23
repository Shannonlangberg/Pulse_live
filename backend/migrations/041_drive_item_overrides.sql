-- Migration: Drive item display name overrides
-- Created: 2025-01-10
-- Description: Allows custom display names for Google Drive files/folders in resource categories

CREATE TABLE IF NOT EXISTS drive_item_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    drive_item_id TEXT NOT NULL,
    custom_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_drive_overrides_category
        FOREIGN KEY (category_id)
        REFERENCES resource_categories(id)
        ON DELETE CASCADE,
    UNIQUE(category_id, drive_item_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_overrides_category
    ON drive_item_overrides(category_id);

CREATE INDEX IF NOT EXISTS idx_drive_overrides_drive_item
    ON drive_item_overrides(drive_item_id);

CREATE TRIGGER IF NOT EXISTS trg_drive_overrides_updated_at
AFTER UPDATE ON drive_item_overrides
BEGIN
    UPDATE drive_item_overrides
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

